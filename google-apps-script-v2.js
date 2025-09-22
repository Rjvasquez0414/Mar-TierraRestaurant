/**
 * Google Apps Script for Mar&Tierra Restaurant Advanced Reservation System
 * Version 2.0 - Sistema Avanzado con Gestión de Pagos
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

// ID de su Google Sheet
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Nombre de la hoja donde se guardarán las reservas
const SHEET_NAME = 'Reservas';

// Email del restaurante para notificaciones
const RESTAURANT_EMAIL = 'restaurant@example.com';

// Emails adicionales para notificaciones (separados por coma)
const ADDITIONAL_EMAILS = 'gerencia@example.com,eventos@example.com';

// Activar/desactivar emails
const SEND_CONFIRMATION_EMAIL = true;
const SEND_RESTAURANT_NOTIFICATION = true;

// ============================================
// MENÚ PERSONALIZADO EN GOOGLE SHEETS
// ============================================

/**
 * Crea un menú personalizado cuando se abre el Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍽️ Gestión de Reservas')
    .addItem('✅ Confirmar Pago de Reserva', 'confirmPayment')
    .addItem('📧 Enviar Recordatorio de Pago', 'sendPaymentReminder')
    .addItem('📨 Enviar Confirmación Final', 'sendFinalConfirmation')
    .addSeparator()
    .addItem('📊 Ver Estadísticas', 'showStatistics')
    .addItem('🔍 Buscar Reserva', 'searchReservation')
    .addSeparator()
    .addItem('⚙️ Configuración', 'showConfiguration')
    .addItem('ℹ️ Ayuda', 'showHelp')
    .addToUi();
}

/**
 * Confirma el pago de una reserva seleccionada
 */
function confirmPayment() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const row = range.getRow();
  
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Por favor seleccione una reserva válida (no el encabezado).');
    return;
  }
  
  // Obtener datos de la reserva
  const statusColumn = 15; // Columna de Estado de Pago
  const emailColumn = 5; // Columna de Email
  const nameColumn = 3; // Columna de Nombre
  
  const currentStatus = sheet.getRange(row, statusColumn).getValue();
  
  if (currentStatus === 'Confirmado') {
    SpreadsheetApp.getUi().alert('Esta reserva ya está confirmada.');
    return;
  }
  
  // Actualizar estado
  sheet.getRange(row, statusColumn).setValue('Confirmado');
  sheet.getRange(row, statusColumn - 1).setValue('Confirmada'); // Estado general
  sheet.getRange(row, statusColumn + 1).setValue(new Date()); // Fecha de confirmación
  
  // Colorear la fila de verde suave
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground('#d4f4dd');
  
  // Obtener datos para el email
  const email = sheet.getRange(row, emailColumn).getValue();
  const name = sheet.getRange(row, nameColumn).getValue();
  const date = sheet.getRange(row, 6).getValue();
  const time = sheet.getRange(row, 7).getValue();
  const people = sheet.getRange(row, 8).getValue();
  
  // Enviar email de confirmación
  if (email) {
    sendPaymentConfirmationEmail({
      email: email,
      name: name,
      date: date,
      time: time,
      people: people
    });
  }
  
  SpreadsheetApp.getUi().alert('✅ Pago confirmado y email enviado exitosamente.');
}

/**
 * Envía recordatorio de pago
 */
function sendPaymentReminder() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const row = range.getRow();
  
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Por favor seleccione una reserva válida.');
    return;
  }
  
  const email = sheet.getRange(row, 5).getValue();
  const name = sheet.getRange(row, 3).getValue();
  const totalDeposit = sheet.getRange(row, 12).getValue();
  const date = sheet.getRange(row, 6).getValue();
  
  if (!email) {
    SpreadsheetApp.getUi().alert('No hay email registrado para esta reserva.');
    return;
  }
  
  sendReminderEmail({
    email: email,
    name: name,
    totalDeposit: totalDeposit,
    date: date
  });
  
  // Registrar el recordatorio
  const reminderColumn = 17; // Nueva columna para recordatorios
  const currentReminders = sheet.getRange(row, reminderColumn).getValue() || 0;
  sheet.getRange(row, reminderColumn).setValue(currentReminders + 1);
  sheet.getRange(row, reminderColumn + 1).setValue(new Date()); // Último recordatorio
  
  SpreadsheetApp.getUi().alert('📧 Recordatorio de pago enviado exitosamente.');
}

/**
 * Envía confirmación final con todos los detalles
 */
function sendFinalConfirmation() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const row = range.getRow();
  
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Por favor seleccione una reserva válida.');
    return;
  }
  
  // Recopilar todos los datos
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const reservationData = {
    id: rowData[0],
    name: rowData[2],
    phone: rowData[3],
    email: rowData[4],
    date: rowData[5],
    time: rowData[6],
    people: rowData[7],
    reservationType: rowData[8],
    decorationPlan: rowData[9],
    services: rowData[10],
    totalDeposit: rowData[11],
    comments: rowData[12]
  };
  
  sendFinalConfirmationEmail(reservationData);
  
  SpreadsheetApp.getUi().alert('✉️ Confirmación final enviada exitosamente.');
}

// ============================================
// FUNCIONES PRINCIPALES DEL WEB APP
// ============================================

/**
 * Función principal que recibe las peticiones POST
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Guardar en Google Sheet
    const result = saveReservation(data);
    
    // Enviar emails si está configurado
    if (SEND_CONFIRMATION_EMAIL && data.email) {
      sendInitialConfirmationEmail(data);
    }
    
    if (SEND_RESTAURANT_NOTIFICATION && RESTAURANT_EMAIL !== 'restaurant@example.com') {
      sendRestaurantNotification(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Reserva guardada exitosamente',
      reservationId: result.reservationId,
      requiresPayment: true,
      depositAmount: data.totalDeposit
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('Error processing reservation:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error al procesar la reserva',
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función GET para verificar el estado del script
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'active',
    message: 'Mar&Tierra Advanced Reservation System API v2.0',
    version: '2.0.0',
    features: ['payment-tracking', 'advanced-notifications', 'custom-menu']
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Guarda la reserva en Google Sheets con columnas extendidas
 */
function saveReservation(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  
  // Si la hoja no existe, crearla con las nuevas columnas
  if (!sheet) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const newSheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Headers actualizados
    const headers = [
      'ID Reserva',
      'Timestamp',
      'Nombre',
      'Teléfono',
      'Email',
      'Fecha',
      'Hora',
      'Personas',
      'Tipo de Reserva',
      'Plan Decoración',
      'Servicios Adicionales',
      'Anticipo Total',
      'Comentarios',
      'Estado',
      'Estado Pago',
      'Fecha Confirmación',
      'Recordatorios Enviados',
      'Último Recordatorio',
      'Fecha de Registro',
      'Notas Internas'
    ];
    
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Formatear headers
    newSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0056D2')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Ajustar ancho de columnas
    newSheet.setColumnWidth(1, 120); // ID
    newSheet.setColumnWidth(2, 150); // Timestamp
    newSheet.setColumnWidth(3, 200); // Nombre
    newSheet.setColumnWidth(5, 200); // Email
    newSheet.setColumnWidth(12, 120); // Anticipo
    
    // Crear validación de datos para Estado y Estado Pago
    const estadoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pendiente de pago', 'Confirmada', 'Cancelada', 'Completada'])
      .build();
    newSheet.getRange(2, 14, 1000, 1).setDataValidation(estadoRule);
    
    const pagoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Por verificar', 'Confirmado', 'Rechazado'])
      .build();
    newSheet.getRange(2, 15, 1000, 1).setDataValidation(pagoRule);
    
    sheet = newSheet;
  }
  
  // Generar ID de reserva
  const reservationId = 'RES-' + Date.now();
  
  // Preparar datos de la fila
  const rowData = [
    reservationId,
    data.timestamp || new Date().toISOString(),
    data.name,
    data.phone,
    data.email,
    data.date,
    data.time,
    data.people,
    data.reservationType || 'regular',
    data.decorationPlan || 'none',
    data.additionalServices || 'Ninguno',
    data.totalDeposit || '$0',
    data.comments || '',
    data.status || 'Pendiente de pago',
    data.paymentStatus || 'Por verificar',
    '', // Fecha confirmación (vacío inicialmente)
    0, // Recordatorios enviados
    '', // Último recordatorio
    new Date().toLocaleString('es-CO', {timeZone: 'America/Bogota'}),
    '' // Notas internas
  ];
  
  // Agregar la fila
  sheet.appendRow(rowData);
  
  // Colorear según el estado
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, rowData.length).setBackground('#fff3cd'); // Amarillo suave para pendiente
  
  // Auto-ajustar columnas
  sheet.autoResizeColumns(1, rowData.length);
  
  return {
    reservationId: reservationId,
    rowNumber: lastRow
  };
}

// ============================================
// FUNCIONES DE EMAIL
// ============================================

/**
 * Email inicial de confirmación de recepción
 */
function sendInitialConfirmationEmail(data) {
  try {
    const subject = '📋 Reserva Recibida - Mar&Tierra Restaurant';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #0056D2, #D4AF37); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .reservation-box { background: #f9f9f9; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #D4AF37; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
          .detail-label { font-weight: 600; color: #555; }
          .detail-value { color: #222; }
          .payment-section { background: #fff3cd; padding: 25px; border-radius: 10px; margin: 30px 0; border: 2px solid #ffc107; }
          .payment-title { color: #856404; font-size: 20px; font-weight: bold; margin-bottom: 15px; }
          .button { display: inline-block; padding: 15px 35px; background: #0056D2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #2c3e50; color: white; padding: 30px; text-align: center; }
          .warning { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f5c6cb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 32px;">¡Reserva Recibida!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Pendiente de confirmación de pago</p>
          </div>
          
          <div class="content">
            <p style="font-size: 18px;">Estimado/a <strong>${data.name}</strong>,</p>
            
            <p>Hemos recibido su solicitud de reserva. A continuación los detalles:</p>
            
            <div class="reservation-box">
              <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👥 Personas:</span>
                <span class="detail-value">${data.people}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🎯 Tipo de Reserva:</span>
                <span class="detail-value">${formatReservationType(data.reservationType)}</span>
              </div>
              ${data.decorationPlan && data.decorationPlan !== 'none' ? `
              <div class="detail-row">
                <span class="detail-label">🎨 Decoración:</span>
                <span class="detail-value">${formatDecorationPlan(data.decorationPlan)}</span>
              </div>` : ''}
              ${data.additionalServices && data.additionalServices !== 'Ninguno' ? `
              <div class="detail-row">
                <span class="detail-label">🎵 Servicios:</span>
                <span class="detail-value">${data.additionalServices}</span>
              </div>` : ''}
            </div>
            
            <div class="payment-section">
              <div class="payment-title">⚠️ ACCIÓN REQUERIDA: Confirmar Reserva</div>
              <p><strong>Anticipo Total Requerido:</strong> <span style="font-size: 24px; color: #0056D2;">${data.totalDeposit}</span></p>
              
              <p><strong>Para confirmar su reserva, realice el pago a:</strong></p>
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Banco:</strong> [INFORMACIÓN PENDIENTE]</p>
                <p style="margin: 5px 0;"><strong>Cuenta:</strong> XXXX-XXXX-XXXX</p>
                <p style="margin: 5px 0;"><strong>Tipo:</strong> Cuenta de Ahorros</p>
                <p style="margin: 5px 0;"><strong>Titular:</strong> Mar&Tierra Restaurant SAS</p>
              </div>
              
              <p style="color: #856404;">
                <strong>IMPORTANTE:</strong> Su reserva será confirmada únicamente después de verificar el pago.
                Por favor, envíe el comprobante de pago respondiendo a este correo.
              </p>
            </div>
            
            <div class="warning">
              <strong>Política de Cancelación:</strong><br>
              • Cancelaciones con menos de 48 horas no tienen devolución<br>
              • Puede reagendar sujeto a disponibilidad<br>
              • La mesa se mantiene hasta 30 minutos después de la hora acordada
            </div>
            
            <h3>📍 Ubicación</h3>
            <p>
              Cra 35a #46-102, Barrio Cabecera del Llano<br>
              Bucaramanga, Colombia<br>
              📞 300 826 3403
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} Mar&Tierra Restaurant</p>
            <p style="margin: 5px 0;">Síguenos en Instagram: @marytierrarestaurantbga</p>
            <p style="margin: 10px 0; font-size: 12px;">Este es un correo automático. Por favor no responda directamente a este mensaje.</p>
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
    console.error('Error sending initial confirmation email:', error);
  }
}

/**
 * Email de confirmación de pago
 */
function sendPaymentConfirmationEmail(data) {
  try {
    const subject = '✅ Pago Confirmado - Reserva Confirmada - Mar&Tierra Restaurant';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #28a745, #D4AF37); color: white; padding: 40px; text-align: center; }
          .content { background: white; padding: 40px; }
          .success-box { background: #d4f4dd; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
          .details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ ¡Reserva Confirmada!</h1>
            <p>Su pago ha sido verificado exitosamente</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h2 style="color: #28a745; margin: 0;">¡Todo listo para su visita!</h2>
              <p>Lo esperamos el ${formatDate(data.date)} a las ${data.time}</p>
            </div>
            
            <p>Estimado/a <strong>${data.name}</strong>,</p>
            
            <p>Confirmamos la recepción de su pago. Su reserva está completamente confirmada.</p>
            
            <div class="details">
              <h3>Detalles de su Reserva Confirmada:</h3>
              <p>📅 <strong>Fecha:</strong> ${formatDate(data.date)}</p>
              <p>🕐 <strong>Hora:</strong> ${data.time}</p>
              <p>👥 <strong>Personas:</strong> ${data.people}</p>
              <p>✅ <strong>Estado:</strong> CONFIRMADA</p>
            </div>
            
            <p><strong>Recordatorios importantes:</strong></p>
            <ul>
              <li>Por favor llegue puntual a su reserva</li>
              <li>La mesa se mantiene hasta 30 minutos después de la hora acordada</li>
              <li>El anticipo será descontado de su cuenta final</li>
            </ul>
            
            <p>¡Esperamos brindarle una experiencia gastronómica inolvidable!</p>
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
    console.error('Error sending payment confirmation:', error);
  }
}

/**
 * Email recordatorio de pago
 */
function sendReminderEmail(data) {
  try {
    const subject = '🔔 Recordatorio: Complete su Reserva - Mar&Tierra Restaurant';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #ffc107; color: #333; padding: 30px; text-align: center; }
          .content { background: white; padding: 40px; }
          .reminder-box { background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Recordatorio de Pago</h1>
          </div>
          
          <div class="content">
            <p>Estimado/a <strong>${data.name}</strong>,</p>
            
            <div class="reminder-box">
              <p><strong>Su reserva para el ${formatDate(data.date)} está pendiente de confirmación.</strong></p>
              <p>Anticipo requerido: <strong>${data.totalDeposit}</strong></p>
              <p>Por favor complete el pago lo antes posible para garantizar su reserva.</p>
            </div>
            
            <p>Si ya realizó el pago, por favor envíenos el comprobante respondiendo a este correo.</p>
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
    console.error('Error sending reminder:', error);
  }
}

/**
 * Email de confirmación final con todos los detalles
 */
function sendFinalConfirmationEmail(data) {
  try {
    const subject = '🌟 Confirmación Final de Reserva - Mar&Tierra Restaurant';
    
    const decorationDetails = getDecorationDetails(data.decorationPlan);
    const servicesDetails = getServicesDetails(data.services);
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.8; color: #2c3e50; background: #f8f9fa; }
          .container { max-width: 650px; margin: 20px auto; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { 
            background: linear-gradient(135deg, #0056D2, #D4AF37); 
            color: white; 
            padding: 50px 30px; 
            text-align: center;
            position: relative;
          }
          .header h1 { margin: 0; font-size: 36px; font-weight: 300; letter-spacing: 2px; }
          .header p { margin: 10px 0 0 0; font-size: 18px; opacity: 0.95; }
          .content { padding: 40px 35px; }
          .reservation-card {
            background: linear-gradient(135deg, #f8f9fa, #ffffff);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            border: 1px solid #e9ecef;
            box-shadow: 0 4px 6px rgba(0,0,0,0.07);
          }
          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
          }
          .detail-item {
            padding: 15px;
            background: white;
            border-radius: 8px;
            border-left: 3px solid #D4AF37;
          }
          .detail-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          .detail-value {
            font-size: 16px;
            color: #2c3e50;
            font-weight: 600;
          }
          .services-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
          }
          .service-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            border: 1px solid #e9ecef;
          }
          .service-icon {
            font-size: 24px;
            margin-right: 15px;
          }
          .qr-code {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
          }
          .footer {
            background: #2c3e50;
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .important-note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .gold-badge {
            display: inline-block;
            background: linear-gradient(135deg, #D4AF37, #B8860B);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmación Final</h1>
            <p>Su experiencia gastronómica está confirmada</p>
            ${data.reservationType === 'salon-gold' ? '<span class="gold-badge">SALÓN GOLD</span>' : ''}
          </div>
          
          <div class="content">
            <p style="font-size: 20px; text-align: center; color: #0056D2;">
              Estimado/a <strong>${data.name}</strong>
            </p>
            
            <p style="text-align: center; color: #6c757d;">
              Nos complace confirmar todos los detalles de su reserva
            </p>
            
            <div class="reservation-card">
              <h3 style="margin-top: 0; color: #0056D2;">📋 Detalles de la Reserva</h3>
              
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-label">Código de Reserva</div>
                  <div class="detail-value">${data.id}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Fecha</div>
                  <div class="detail-value">${formatDate(data.date)}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Hora</div>
                  <div class="detail-value">${data.time}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Número de Personas</div>
                  <div class="detail-value">${data.people} personas</div>
                </div>
              </div>
              
              ${decorationDetails || servicesDetails ? `
              <div class="services-section">
                <h4 style="margin-top: 0;">✨ Servicios Especiales Confirmados</h4>
                ${decorationDetails ? decorationDetails : ''}
                ${servicesDetails ? servicesDetails : ''}
              </div>
              ` : ''}
              
              ${data.comments && data.comments !== 'Sin comentarios' ? `
              <div class="important-note">
                <strong>Notas Especiales:</strong><br>
                ${data.comments}
              </div>
              ` : ''}
            </div>
            
            <div class="important-note">
              <strong>📌 Recordatorios Importantes:</strong>
              <ul style="margin: 10px 0;">
                <li>Por favor llegue puntual a su reserva</li>
                <li>La mesa se garantiza hasta 30 minutos después de la hora acordada</li>
                <li>El anticipo de ${data.totalDeposit} será descontado de su cuenta final</li>
                ${data.reservationType === 'salon-gold' ? '<li>Acceso exclusivo al Salón Gold con atención personalizada</li>' : ''}
              </ul>
            </div>
            
            <div class="qr-code">
              <p style="color: #6c757d; margin-bottom: 10px;">Muestre este código al llegar:</p>
              <div style="background: white; padding: 20px; display: inline-block; border: 2px solid #0056D2; border-radius: 10px;">
                <strong style="font-size: 24px; color: #0056D2;">${data.id}</strong>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <h3 style="color: #0056D2;">📍 Nos encontrará en:</h3>
              <p>
                Cra 35a #46-102, Barrio Cabecera del Llano<br>
                Bucaramanga, Colombia<br>
                📞 300 826 3403
              </p>
            </div>
          </div>
          
          <div class="footer">
            <h3 style="margin-top: 0;">¡Lo esperamos!</h3>
            <p>Prepárese para una experiencia gastronómica inolvidable</p>
            <div style="margin: 20px 0;">
              <p style="margin: 5px;">© ${new Date().getFullYear()} Mar&Tierra Restaurant</p>
              <p style="margin: 5px;">Instagram: @marytierrarestaurantbga</p>
            </div>
            <p style="font-size: 12px; opacity: 0.8;">
              Este es un correo de confirmación automático. Guárdelo para su referencia.
            </p>
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
    console.error('Error sending final confirmation:', error);
  }
}

/**
 * Notificación mejorada al restaurante
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
          .label { font-weight: bold; color: #666; display: inline-block; width: 150px; }
          .highlight { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .deposit-amount { font-size: 24px; color: #0056D2; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📋 Nueva Reserva Recibida</h2>
            <p>${data.reservationType === 'especial' || data.reservationType === 'salon-gold' ? '⭐ RESERVA ESPECIAL' : ''}</p>
          </div>
          
          <div class="content">
            <div class="highlight">
              <strong>Anticipo Requerido:</strong> <span class="deposit-amount">${data.totalDeposit}</span>
              <br><small>Estado: Pendiente de verificación de pago</small>
            </div>
            
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
              <span class="label">Tipo de Reserva:</span> ${formatReservationType(data.reservationType)}
            </div>
            ${data.decorationPlan && data.decorationPlan !== 'none' ? `
            <div class="detail-row">
              <span class="label">Decoración:</span> ${formatDecorationPlan(data.decorationPlan)}
            </div>` : ''}
            ${data.additionalServices && data.additionalServices !== 'Ninguno' ? `
            <div class="detail-row">
              <span class="label">Servicios:</span> ${data.additionalServices}
            </div>` : ''}
            <div class="detail-row">
              <span class="label">Comentarios:</span> ${data.comments || 'Sin comentarios'}
            </div>
            <div class="detail-row">
              <span class="label">Registrado:</span> ${new Date().toLocaleString('es-CO', {timeZone: 'America/Bogota'})}
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}" 
                 style="background: #0056D2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                📊 Ver en Google Sheets
              </a>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 5px;">
              <strong>Acciones pendientes:</strong>
              <ol>
                <li>Verificar pago del anticipo</li>
                <li>Confirmar reserva en el sistema</li>
                <li>Preparar servicios especiales solicitados</li>
              </ol>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Enviar al email principal
    MailApp.sendEmail({
      to: RESTAURANT_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });
    
    // Enviar a emails adicionales si están configurados
    if (ADDITIONAL_EMAILS && ADDITIONAL_EMAILS !== '') {
      const additionalEmails = ADDITIONAL_EMAILS.split(',').map(email => email.trim());
      additionalEmails.forEach(email => {
        if (email) {
          MailApp.sendEmail({
            to: email,
            subject: subject,
            htmlBody: htmlBody
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Error sending restaurant notification:', error);
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Formatea la fecha para mostrar
 */
function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

/**
 * Formatea el tipo de reserva
 */
function formatReservationType(type) {
  const types = {
    'regular': 'Reserva Regular',
    'especial': 'Reserva Especial (Grupo Grande)',
    'salon-gold': 'Salón Gold (Exclusivo)'
  };
  return types[type] || type;
}

/**
 * Formatea el plan de decoración
 */
function formatDecorationPlan(plan) {
  const plans = {
    'none': 'Sin decoración',
    'plata': 'Plan Plata (Globos + Pastel)',
    'oro': 'Plan Oro (Vino + Globos + Pastel)',
    'luxury': 'Plan Luxury (Rosas + Pétalos)',
    'combo-plata-luxury': 'Combo Plata + Luxury',
    'combo-oro-luxury': 'Combo Oro + Luxury'
  };
  return plans[plan] || plan;
}

/**
 * Obtiene detalles de decoración para el email
 */
function getDecorationDetails(plan) {
  if (!plan || plan === 'none') return '';
  
  const details = {
    'plata': '<div class="service-item"><span class="service-icon">🎈</span><div><strong>Plan Plata</strong><br>3 globos con helio + 1 porción de pastel</div></div>',
    'oro': '<div class="service-item"><span class="service-icon">🍷</span><div><strong>Plan Oro</strong><br>Botella de vino 375ml + 3 globos con helio + 1 porción de pastel</div></div>',
    'luxury': '<div class="service-item"><span class="service-icon">🌹</span><div><strong>Plan Luxury</strong><br>Jarrón de rosas en la mesa con pétalos decorativos</div></div>',
    'combo-plata-luxury': '<div class="service-item"><span class="service-icon">✨</span><div><strong>Combo Especial</strong><br>Plan Plata + Plan Luxury combinados</div></div>',
    'combo-oro-luxury': '<div class="service-item"><span class="service-icon">🌟</span><div><strong>Combo Premium</strong><br>Plan Oro + Plan Luxury combinados</div></div>'
  };
  
  return details[plan] || '';
}

/**
 * Obtiene detalles de servicios para el email
 */
function getServicesDetails(services) {
  if (!services || services === 'Ninguno') return '';
  
  const servicesList = services.split(', ');
  let html = '';
  
  const serviceDetails = {
    'saxofonista': '<div class="service-item"><span class="service-icon">🎷</span><div><strong>Saxofonista</strong><br>1 hora de show en vivo</div></div>',
    'violinista': '<div class="service-item"><span class="service-icon">🎻</span><div><strong>Violinista</strong><br>1 hora de presentación musical</div></div>',
    'fotografo': '<div class="service-item"><span class="service-icon">📸</span><div><strong>Fotógrafo Profesional</strong><br>2 horas de servicio fotográfico</div></div>',
    'dj': '<div class="service-item"><span class="service-icon">🎵</span><div><strong>DJ Profesional</strong><br>3 horas de música y ambiente</div></div>'
  };
  
  servicesList.forEach(service => {
    if (serviceDetails[service]) {
      html += serviceDetails[service];
    }
  });
  
  return html;
}

// ============================================
// FUNCIONES DE MENÚ ADICIONALES
// ============================================

/**
 * Muestra estadísticas de reservas
 */
function showStatistics() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('No hay datos de reservas para mostrar estadísticas.');
    return;
  }
  
  let pendientes = 0;
  let confirmadas = 0;
  let canceladas = 0;
  let totalAnticipo = 0;
  
  for (let i = 1; i < data.length; i++) {
    const estado = data[i][13]; // Columna de Estado
    const anticipo = data[i][11]; // Columna de Anticipo
    
    if (estado === 'Pendiente de pago') pendientes++;
    else if (estado === 'Confirmada') confirmadas++;
    else if (estado === 'Cancelada') canceladas++;
    
    // Extraer valor numérico del anticipo
    if (anticipo) {
      const valor = parseInt(anticipo.toString().replace(/[^0-9]/g, ''));
      if (!isNaN(valor)) totalAnticipo += valor;
    }
  }
  
  const mensaje = `
📊 ESTADÍSTICAS DE RESERVAS

Total de Reservas: ${data.length - 1}
━━━━━━━━━━━━━━━━━━━━
⏳ Pendientes: ${pendientes}
✅ Confirmadas: ${confirmadas}
❌ Canceladas: ${canceladas}
━━━━━━━━━━━━━━━━━━━━
💰 Total en Anticipos: ${formatCurrency(totalAnticipo)}
💵 Promedio por Reserva: ${formatCurrency(totalAnticipo / (data.length - 1))}
  `;
  
  SpreadsheetApp.getUi().alert('Estadísticas de Reservas', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Busca una reserva específica
 */
function searchReservation() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Buscar Reserva', 
    'Ingrese el nombre, teléfono o ID de reserva:', 
    ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const searchTerm = response.getResponseText().toLowerCase();
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    const rowData = data[i].join(' ').toLowerCase();
    
    if (rowData.includes(searchTerm)) {
      sheet.setActiveRange(sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()));
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground('#ffffcc');
      found = true;
      break;
    }
  }
  
  if (!found) {
    ui.alert('No se encontró ninguna reserva con ese criterio de búsqueda.');
  }
}

/**
 * Muestra la configuración actual
 */
function showConfiguration() {
  const mensaje = `
⚙️ CONFIGURACIÓN ACTUAL

📧 Email del Restaurante: ${RESTAURANT_EMAIL}
📨 Emails Adicionales: ${ADDITIONAL_EMAILS || 'No configurados'}
━━━━━━━━━━━━━━━━━━━━
📬 Enviar confirmación al cliente: ${SEND_CONFIRMATION_EMAIL ? 'Sí' : 'No'}
📭 Enviar notificación al restaurante: ${SEND_RESTAURANT_NOTIFICATION ? 'Sí' : 'No'}
━━━━━━━━━━━━━━━━━━━━
📊 ID del Spreadsheet: ${SPREADSHEET_ID}
📋 Nombre de la hoja: ${SHEET_NAME}

Para modificar estos valores, edite el script en:
Extensiones > Apps Script
  `;
  
  SpreadsheetApp.getUi().alert('Configuración del Sistema', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Muestra ayuda del sistema
 */
function showHelp() {
  const mensaje = `
ℹ️ AYUDA - SISTEMA DE RESERVAS

FUNCIONES PRINCIPALES:
━━━━━━━━━━━━━━━━━━━━
✅ Confirmar Pago: Marca una reserva como pagada y envía confirmación
📧 Recordatorio de Pago: Envía recordatorio al cliente
📨 Confirmación Final: Envía todos los detalles de la reserva
━━━━━━━━━━━━━━━━━━━━

CÓMO USAR:
1. Seleccione la fila de la reserva
2. Vaya al menú "🍽️ Gestión de Reservas"
3. Elija la acción deseada

ESTADOS DE RESERVA:
• Pendiente de pago: Esperando confirmación
• Confirmada: Pago verificado
• Cancelada: Reserva cancelada
• Completada: Cliente ya asistió

CÓDIGOS DE COLOR:
🟡 Amarillo: Pendiente
🟢 Verde: Confirmada
🔴 Rojo: Cancelada
⚪ Gris: Completada

¿Necesita más ayuda?
Contacte al administrador del sistema
  `;
  
  SpreadsheetApp.getUi().alert('Ayuda del Sistema', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Función para probar la configuración
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
      name: 'Cliente de Prueba',
      phone: '123456789',
      email: 'test@example.com',
      date: '2024-12-25',
      time: '19:00',
      people: '4',
      reservationType: 'especial',
      decorationPlan: 'oro',
      additionalServices: 'saxofonista, fotografo',
      totalDeposit: '$580,000',
      comments: 'Reserva de prueba del sistema'
    };
    
    const result = saveReservation(testData);
    console.log('✅ Test reservation saved:', result);
    
    SpreadsheetApp.getUi().alert('✅ Prueba exitosa! Revise la hoja de cálculo.');
    
    return 'Configuration test successful!';
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    SpreadsheetApp.getUi().alert('❌ Error en la prueba: ' + error.toString());
    return 'Configuration test failed: ' + error.toString();
  }
}

/**
 * Formatea valores monetarios
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}