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
const SPREADSHEET_ID = '1JDQNehQpFpYgB55-zJF8pMlezBsXhRm3mgbr6W3LlHs';

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
// CONFIGURACIÓN DE SALONES Y DISPONIBILIDAD
// ============================================

const SALON_CONFIG = {
  'moon-terraza': {
    name: 'Moon Terraza',
    capacity: 30,
    maxReservationsPerSlot: 3,  // Máximo 3 reservas simultáneas
    minPeoplePerReservation: 1,
    allowsSharedBooking: true
  },
  'golden': {
    name: 'Salón Golden',
    capacity: 44,
    maxReservationsPerSlot: 4,  // Puede compartirse
    minPeoplePerReservation: 1,
    allowsSharedBooking: true,
    exclusiveThreshold: 30  // Si reservan 30+ personas, es exclusivo
  },
  'arca': {
    name: 'Arca',
    capacity: 60,
    maxReservationsPerSlot: 5,
    minPeoplePerReservation: 1,
    allowsSharedBooking: true
  },
  'barco': {
    name: 'Barco',
    capacity: 16,
    maxReservationsPerSlot: 2,
    minPeoplePerReservation: 1,
    allowsSharedBooking: true
  },
  'chill-out': {
    name: 'Chill Out',
    capacity: 8,
    maxReservationsPerSlot: 1,  // Solo 1 reserva a la vez (espacio pequeño)
    minPeoplePerReservation: 1,
    allowsSharedBooking: false
  }
};

// Duración estimada de una reserva en horas (para calcular conflictos)
const RESERVATION_DURATION_HOURS = 2;

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
    .addItem('✔️ Marcar como Completada', 'markAsCompleted')
    .addItem('❌ Cancelar Reserva', 'cancelReservation')
    .addSeparator()
    .addItem('🎨 Aplicar Formato Condicional', 'applyConditionalFormatting')
    .addItem('📊 Ver Estadísticas', 'showStatistics')
    .addItem('🔍 Buscar Reserva', 'searchReservation')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Automatización')
      .addItem('⏰ Activar Recordatorios Automáticos (24h)', 'setupReminderTrigger')
      .addItem('📅 Activar Resumen Diario (7:00 AM)', 'setupDailySummaryTrigger'))
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

    // PASO 1: Verificar disponibilidad antes de guardar
    const salonId = data.salonId || getSalonIdFromName(data.salon);
    const people = parseInt(data.people) || 1;

    if (salonId && data.date && data.time) {
      const availability = checkAvailability(salonId, data.date, data.time, people);

      if (!availability.available) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: availability.message || 'No hay disponibilidad para esta reserva',
          reason: availability.reason,
          availabilityDetails: availability
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // PASO 2: Guardar en Google Sheet (solo si hay disponibilidad)
    const result = saveReservation(data);

    // PASO 3: Enviar emails si está configurado
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
 * Convierte el nombre del salón a su ID
 */
function getSalonIdFromName(salonName) {
  if (!salonName) return null;

  const nameLower = salonName.toLowerCase();

  for (const [id, config] of Object.entries(SALON_CONFIG)) {
    if (id === nameLower || config.name.toLowerCase() === nameLower) {
      return id;
    }
  }

  return null;
}

/**
 * Función GET para verificar disponibilidad y estado del script
 * Parámetros opcionales: action, salon, date, time, people
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'status';

    // Acción: Verificar estado del sistema
    if (action === 'status') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'active',
        message: 'Mar&Tierra Advanced Reservation System API v3.0',
        version: '3.0.0',
        features: ['payment-tracking', 'advanced-notifications', 'availability-check', 'salon-management']
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Acción: Verificar disponibilidad
    if (action === 'check-availability') {
      const salon = params.salon;
      const date = params.date;
      const time = params.time;
      const people = parseInt(params.people) || 1;

      if (!salon || !date || !time) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Parámetros requeridos: salon, date, time, people'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const availability = checkAvailability(salon, date, time, people);
      return ContentService.createTextOutput(JSON.stringify(availability))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Acción: Obtener disponibilidad de todos los salones para una fecha/hora
    if (action === 'get-all-availability') {
      const date = params.date;
      const time = params.time;
      const people = parseInt(params.people) || 1;

      if (!date || !time) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Parámetros requeridos: date, time'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const allAvailability = getAllSalonsAvailability(date, time, people);
      return ContentService.createTextOutput(JSON.stringify(allAvailability))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Acción: Obtener horarios disponibles para un salón y fecha
    if (action === 'get-available-times') {
      const salon = params.salon;
      const date = params.date;
      const people = parseInt(params.people) || 1;

      if (!salon || !date) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Parámetros requeridos: salon, date'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const availableTimes = getAvailableTimesForSalon(salon, date, people);
      return ContentService.createTextOutput(JSON.stringify(availableTimes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Acción: Obtener configuración de salones
    if (action === 'get-salon-config') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        salons: SALON_CONFIG
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Acción no reconocida
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Acción no reconocida. Acciones disponibles: status, check-availability, get-all-availability, get-available-times, get-salon-config'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doGet:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// FUNCIONES DE DISPONIBILIDAD
// ============================================

/**
 * Verifica la disponibilidad de un salón para una fecha, hora y número de personas
 * @param {string} salonId - ID del salón (ej: 'golden', 'moon-terraza')
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @param {string} time - Hora en formato HH:MM
 * @param {number} people - Número de personas
 * @returns {Object} Información de disponibilidad
 */
function checkAvailability(salonId, date, time, people) {
  try {
    const salonConfig = SALON_CONFIG[salonId];

    if (!salonConfig) {
      return {
        success: false,
        available: false,
        error: 'Salón no encontrado',
        salonId: salonId
      };
    }

    // Verificar capacidad básica
    if (people > salonConfig.capacity) {
      return {
        success: true,
        available: false,
        reason: 'CAPACITY_EXCEEDED',
        message: `El ${salonConfig.name} tiene capacidad máxima de ${salonConfig.capacity} personas`,
        salonCapacity: salonConfig.capacity,
        requestedPeople: people
      };
    }

    // Obtener reservas existentes para ese salón, fecha y rango de tiempo
    const existingReservations = getReservationsForSlot(salonId, date, time);

    // Calcular personas ya reservadas
    let totalPeopleReserved = 0;
    existingReservations.forEach(res => {
      totalPeopleReserved += parseInt(res.people) || 0;
    });

    // Verificar si hay una reserva exclusiva (30+ personas en Golden)
    if (salonConfig.exclusiveThreshold) {
      const hasExclusiveReservation = existingReservations.some(res =>
        parseInt(res.people) >= salonConfig.exclusiveThreshold
      );

      if (hasExclusiveReservation) {
        return {
          success: true,
          available: false,
          reason: 'EXCLUSIVE_BOOKING',
          message: `El ${salonConfig.name} está reservado de forma exclusiva para este horario`,
          existingReservations: existingReservations.length
        };
      }

      // Si la nueva reserva es exclusiva (30+), verificar que no haya nadie
      if (people >= salonConfig.exclusiveThreshold && existingReservations.length > 0) {
        return {
          success: true,
          available: false,
          reason: 'CANNOT_BOOK_EXCLUSIVE',
          message: `No se puede reservar el ${salonConfig.name} de forma exclusiva porque ya hay reservas existentes`,
          existingReservations: existingReservations.length,
          totalPeopleReserved: totalPeopleReserved
        };
      }
    }

    // Verificar número máximo de reservas por slot
    if (existingReservations.length >= salonConfig.maxReservationsPerSlot) {
      return {
        success: true,
        available: false,
        reason: 'MAX_RESERVATIONS_REACHED',
        message: `El ${salonConfig.name} ya tiene el máximo de reservas para este horario`,
        maxReservations: salonConfig.maxReservationsPerSlot,
        currentReservations: existingReservations.length
      };
    }

    // Verificar si se permite reserva compartida
    if (!salonConfig.allowsSharedBooking && existingReservations.length > 0) {
      return {
        success: true,
        available: false,
        reason: 'NO_SHARED_BOOKING',
        message: `El ${salonConfig.name} no permite reservas compartidas y ya está ocupado`,
        existingReservations: existingReservations.length
      };
    }

    // Verificar capacidad restante
    const remainingCapacity = salonConfig.capacity - totalPeopleReserved;
    if (people > remainingCapacity) {
      return {
        success: true,
        available: false,
        reason: 'INSUFFICIENT_CAPACITY',
        message: `Solo quedan ${remainingCapacity} lugares disponibles en el ${salonConfig.name} para este horario`,
        remainingCapacity: remainingCapacity,
        requestedPeople: people,
        totalPeopleReserved: totalPeopleReserved
      };
    }

    // ¡Disponible!
    return {
      success: true,
      available: true,
      salonId: salonId,
      salonName: salonConfig.name,
      date: date,
      time: time,
      requestedPeople: people,
      remainingCapacity: remainingCapacity - people,
      currentReservations: existingReservations.length,
      totalPeopleReserved: totalPeopleReserved,
      message: `Disponible en ${salonConfig.name}`
    };

  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      success: false,
      available: false,
      error: error.toString()
    };
  }
}

/**
 * Obtiene las reservas existentes para un salón en un rango de tiempo
 * Considera la duración de las reservas para detectar conflictos
 */
function getReservationsForSlot(salonId, date, time) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const reservations = [];
    const requestedTimeMinutes = timeToMinutes(time);
    const reservationDurationMinutes = RESERVATION_DURATION_HOURS * 60;

    // Mapear nombres de salón a IDs
    const salonNameToId = {};
    Object.keys(SALON_CONFIG).forEach(id => {
      salonNameToId[SALON_CONFIG[id].name.toLowerCase()] = id;
      salonNameToId[id.toLowerCase()] = id;
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowSalon = row[5]; // Columna Salón (índice 5)
      const rowDate = row[6]; // Columna Fecha (índice 6)
      const rowTime = row[7]; // Columna Hora (índice 7)
      const rowPeople = row[8]; // Columna Personas (índice 8)
      const rowStatus = row[14]; // Columna Estado (índice 14, después de Comentarios)

      // Ignorar reservas canceladas o completadas
      if (rowStatus === 'Cancelada' || rowStatus === 'Completada') {
        continue;
      }

      // Verificar salón (comparar tanto ID como nombre)
      const rowSalonLower = rowSalon ? rowSalon.toString().toLowerCase() : '';
      const rowSalonId = salonNameToId[rowSalonLower] || rowSalonLower;

      if (rowSalonId !== salonId && rowSalonLower !== SALON_CONFIG[salonId]?.name.toLowerCase()) {
        continue;
      }

      // Verificar fecha
      let rowDateStr = '';
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, 'America/Bogota', 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string') {
        rowDateStr = rowDate.split('T')[0];
      }

      if (rowDateStr !== date) {
        continue;
      }

      // Verificar conflicto de horario
      const rowTimeMinutes = timeToMinutes(rowTime);

      // Hay conflicto si los rangos de tiempo se superponen
      // Rango existente: [rowTimeMinutes, rowTimeMinutes + duration]
      // Rango solicitado: [requestedTimeMinutes, requestedTimeMinutes + duration]
      const existingStart = rowTimeMinutes;
      const existingEnd = rowTimeMinutes + reservationDurationMinutes;
      const requestedStart = requestedTimeMinutes;
      const requestedEnd = requestedTimeMinutes + reservationDurationMinutes;

      // Verificar superposición
      if (requestedStart < existingEnd && requestedEnd > existingStart) {
        reservations.push({
          id: row[0],
          name: row[2],
          salon: rowSalon,
          date: rowDateStr,
          time: rowTime,
          people: rowPeople,
          status: rowStatus
        });
      }
    }

    return reservations;
  } catch (error) {
    console.error('Error getting reservations for slot:', error);
    return [];
  }
}

/**
 * Convierte una hora (string o Date) a minutos desde medianoche
 */
function timeToMinutes(time) {
  if (!time) return 0;

  let hours, minutes;

  if (time instanceof Date) {
    hours = time.getHours();
    minutes = time.getMinutes();
  } else if (typeof time === 'string') {
    const match = time.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hours = parseInt(match[1]);
      minutes = parseInt(match[2]);
    } else {
      return 0;
    }
  } else {
    return 0;
  }

  return hours * 60 + minutes;
}

/**
 * Obtiene la disponibilidad de todos los salones para una fecha y hora
 */
function getAllSalonsAvailability(date, time, people) {
  const result = {
    success: true,
    date: date,
    time: time,
    people: people,
    salons: {}
  };

  Object.keys(SALON_CONFIG).forEach(salonId => {
    const availability = checkAvailability(salonId, date, time, people);
    result.salons[salonId] = {
      ...availability,
      config: SALON_CONFIG[salonId]
    };
  });

  return result;
}

/**
 * Obtiene los horarios disponibles para un salón en una fecha específica
 */
function getAvailableTimesForSalon(salonId, date, people) {
  const salonConfig = SALON_CONFIG[salonId];

  if (!salonConfig) {
    return {
      success: false,
      error: 'Salón no encontrado'
    };
  }

  // Horarios de operación (simplificado - idealmente debería venir de configuración)
  const operatingHours = {
    0: { open: '11:30', close: '21:00' }, // Domingo
    1: { open: '11:30', close: '22:00' }, // Lunes
    2: { open: '11:30', close: '23:00' }, // Martes
    3: { open: '11:30', close: '23:00' }, // Miércoles
    4: { open: '11:30', close: '23:00' }, // Jueves
    5: { open: '11:30', close: '23:59' }, // Viernes
    6: { open: '11:30', close: '23:59' }  // Sábado
  };

  // Obtener día de la semana
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = dateObj.getDay();
  const hours = operatingHours[dayOfWeek];

  if (!hours) {
    return {
      success: false,
      error: 'Horario no disponible para este día'
    };
  }

  const openMinutes = timeToMinutes(hours.open);
  const closeMinutes = timeToMinutes(hours.close);
  const lastReservationMinutes = closeMinutes - 60; // Última reserva 1 hora antes del cierre

  const availableTimes = [];
  const unavailableTimes = [];

  // Generar slots cada 30 minutos
  for (let minutes = openMinutes; minutes <= lastReservationMinutes; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

    const availability = checkAvailability(salonId, date, timeStr, people);

    if (availability.available) {
      availableTimes.push({
        time: timeStr,
        remainingCapacity: availability.remainingCapacity,
        currentReservations: availability.currentReservations
      });
    } else {
      unavailableTimes.push({
        time: timeStr,
        reason: availability.reason,
        message: availability.message
      });
    }
  }

  return {
    success: true,
    salonId: salonId,
    salonName: salonConfig.name,
    date: date,
    people: people,
    availableTimes: availableTimes,
    unavailableTimes: unavailableTimes,
    totalSlots: availableTimes.length + unavailableTimes.length,
    availableSlots: availableTimes.length
  };
}

/**
 * Guarda la reserva en Google Sheets con columnas extendidas
 */
function saveReservation(data) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

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
      'Salón',
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
    
    // Crear validación de datos para Estado y Estado Pago (ajustado por columna Salón)
    const estadoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pendiente de pago', 'Confirmada', 'Cancelada', 'Completada'])
      .build();
    newSheet.getRange(2, 15, 1000, 1).setDataValidation(estadoRule);

    const pagoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Por verificar', 'Confirmado', 'Rechazado'])
      .build();
    newSheet.getRange(2, 16, 1000, 1).setDataValidation(pagoRule);
    
    sheet = newSheet;
  }
  
  // Generar ID de reserva
  const reservationId = 'RES-' + Date.now();
  
  // Validar y formatear fecha y hora antes de guardar
  const formattedDate = data.date || '';
  const formattedTime = formatTime(data.time) || data.time || '';

  // Preparar datos de la fila
  const rowData = [
    reservationId,
    data.timestamp || new Date().toISOString(),
    data.name,
    data.phone,
    data.email,
    data.salon || 'Sin asignar',
    formattedDate,
    formattedTime,
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
 * Diseño elegante Mar y Tierra
 */
function sendInitialConfirmationEmail(data) {
  try {
    const subject = 'Reserva Recibida - Mar y Tierra Restaurant';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #4A3429;
            background: #F5EFE6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #FDFBF7;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(74, 52, 41, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4A3429, #6B4C3B);
            color: #FDFBF7;
            padding: 45px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 400;
            letter-spacing: 3px;
            text-transform: uppercase;
          }
          .header .subtitle {
            margin: 15px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
            letter-spacing: 1px;
          }
          .header .divider {
            width: 60px;
            height: 2px;
            background: #C9A961;
            margin: 20px auto 0;
          }
          .content { padding: 40px 35px; }
          .greeting {
            font-size: 18px;
            color: #6B4C3B;
            margin-bottom: 25px;
          }
          .reservation-box {
            background: #F5EFE6;
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #C9A961;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #D4C4AA;
          }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #6B4C3B; }
          .detail-value { color: #4A3429; }
          .payment-section {
            background: linear-gradient(135deg, #F5EFE6, #FDFBF7);
            padding: 30px;
            border-radius: 8px;
            margin: 30px 0;
            border: 2px solid #C9A961;
          }
          .payment-title {
            color: #6B4C3B;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .bank-details {
            background: #FDFBF7;
            padding: 20px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #D4C4AA;
          }
          .bank-details p {
            margin: 8px 0;
            color: #4A3429;
          }
          .footer {
            background: #4A3429;
            color: #D4C4AA;
            padding: 35px 30px;
            text-align: center;
          }
          .footer p { margin: 5px 0; }
          .footer .restaurant-name {
            color: #C9A961;
            font-size: 16px;
            letter-spacing: 2px;
            margin-bottom: 15px;
          }
          .warning {
            background: #F5EFE6;
            color: #6B4C3B;
            padding: 20px;
            border-radius: 6px;
            margin: 25px 0;
            border-left: 4px solid #C9A961;
          }
          .whatsapp-link {
            color: #25D366;
            font-weight: bold;
            text-decoration: none;
          }
          .important-notice {
            background: #6B4C3B;
            color: #FDFBF7;
            padding: 12px 15px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mar y Tierra</h1>
            <p class="subtitle">Restaurant</p>
            <div class="divider"></div>
          </div>

          <div class="content">
            <p class="greeting">Estimado/a <strong>${data.name}</strong>,</p>

            <p>Hemos recibido su solicitud de reserva. A continuación encontrará los detalles:</p>

            <div class="reservation-box">
              <div class="detail-row">
                <span class="detail-label">Fecha</span>
                <span class="detail-value">${formatDate(data.date)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora</span>
                <span class="detail-value">${formatTime(data.time)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Salón</span>
                <span class="detail-value">${data.salon || 'Por asignar'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Personas</span>
                <span class="detail-value">${data.people}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tipo de Reserva</span>
                <span class="detail-value">${formatReservationType(data.reservationType)}</span>
              </div>
              ${data.decorationPlan && data.decorationPlan !== 'none' ? `
              <div class="detail-row">
                <span class="detail-label">Decoración</span>
                <span class="detail-value">${formatDecorationPlan(data.decorationPlan)}</span>
              </div>` : ''}
              ${data.additionalServices && data.additionalServices !== 'Ninguno' ? `
              <div class="detail-row">
                <span class="detail-label">Servicios</span>
                <span class="detail-value">${data.additionalServices}</span>
              </div>` : ''}
            </div>

            <div class="payment-section">
              <div class="payment-title">Acción Requerida: Confirmar Reserva</div>
              <p><strong>Anticipo Total Requerido:</strong></p>
              <p style="font-size: 26px; color: #6B4C3B; font-weight: 600; margin: 10px 0;">${data.totalDeposit}</p>

              <p style="margin-top: 20px;"><strong>Datos para realizar el pago:</strong></p>
              <div class="bank-details">
                <p><strong>Banco:</strong> Bancolombia</p>
                <p><strong>Tipo de Cuenta:</strong> Cuenta Corriente</p>
                <p><strong>Número de Cuenta:</strong> 30200003995</p>
                <p><strong>NIT:</strong> 901857854</p>
                <p><strong>Titular:</strong> MYT RESTAURANT SAS</p>
              </div>

              <p style="color: #6B4C3B; margin-top: 20px;">
                <strong>Importante:</strong> Su reserva será confirmada únicamente después de verificar el pago.
              </p>
              <p style="margin-top: 15px;">
                Una vez realizado el pago, envíe el comprobante al WhatsApp:
                <a href="https://wa.me/573008263403?text=Hola%2C%20adjunto%20comprobante%20de%20pago%20para%20mi%20reserva"
                   class="whatsapp-link">+57 300 826 3403</a>
              </p>
              <div class="important-notice">
                Este número es <strong>únicamente</strong> para enviar comprobantes de pago. No se realizan reservas por este medio.
              </div>
            </div>

            <div class="warning">
              <strong>Política de Cancelación</strong><br><br>
              - Cancelaciones con menos de 48 horas no tienen devolución<br>
              - Puede reagendar sujeto a disponibilidad<br>
              - La mesa se mantiene hasta 30 minutos después de la hora acordada
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #D4C4AA;">
              <h3 style="color: #6B4C3B; margin-bottom: 10px;">Ubicación</h3>
              <p style="margin: 5px 0; color: #4A3429;">
                Cra 35a #46-102, Barrio Cabecera del Llano<br>
                Bucaramanga, Colombia<br>
                Teléfono: 300 826 3403
              </p>
            </div>
          </div>

          <div class="footer">
            <p class="restaurant-name">MAR Y TIERRA RESTAURANT</p>
            <p>Instagram: @marytierrarestaurantbga</p>
            <p style="font-size: 12px; margin-top: 15px; opacity: 0.8;">Este es un correo automático. Por favor no responda directamente a este mensaje.</p>
            <p style="font-size: 11px; margin-top: 10px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Mar y Tierra Restaurant. Todos los derechos reservados.</p>
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
 * Diseño elegante Mar y Tierra
 */
function sendPaymentConfirmationEmail(data) {
  try {
    const subject = 'Pago Confirmado - Reserva Confirmada - Mar y Tierra Restaurant';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #4A3429;
            background: #F5EFE6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #FDFBF7;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(74, 52, 41, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4A3429, #6B4C3B);
            color: #FDFBF7;
            padding: 45px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 400;
            letter-spacing: 3px;
            text-transform: uppercase;
          }
          .header .subtitle {
            margin: 15px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
            letter-spacing: 1px;
          }
          .header .divider {
            width: 60px;
            height: 2px;
            background: #C9A961;
            margin: 20px auto 0;
          }
          .content { padding: 40px 35px; }
          .success-box {
            background: linear-gradient(135deg, #F5EFE6, #FDFBF7);
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 25px 0;
            border: 2px solid #C9A961;
          }
          .success-box h2 {
            color: #6B4C3B;
            margin: 0 0 10px 0;
            font-weight: 500;
          }
          .details {
            background: #F5EFE6;
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #C9A961;
          }
          .details h3 {
            color: #6B4C3B;
            margin-top: 0;
            font-weight: 600;
          }
          .details p {
            margin: 10px 0;
            color: #4A3429;
          }
          .footer {
            background: #4A3429;
            color: #D4C4AA;
            padding: 35px 30px;
            text-align: center;
          }
          .footer p { margin: 5px 0; }
          .footer .restaurant-name {
            color: #C9A961;
            font-size: 16px;
            letter-spacing: 2px;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mar y Tierra</h1>
            <p class="subtitle">Restaurant</p>
            <div class="divider"></div>
          </div>

          <div class="content">
            <div class="success-box">
              <h2>Reserva Confirmada</h2>
              <p style="color: #6B4C3B; margin: 0;">Le esperamos el ${formatDate(data.date)} a las ${formatTime(data.time)}</p>
            </div>

            <p style="font-size: 18px;">Estimado/a <strong>${data.name}</strong>,</p>

            <p>Confirmamos la recepción de su pago. Su reserva está completamente confirmada.</p>

            <div class="details">
              <h3>Detalles de su Reserva</h3>
              <p><strong>Fecha:</strong> ${formatDate(data.date)}</p>
              <p><strong>Hora:</strong> ${formatTime(data.time)}</p>
              <p><strong>Salón:</strong> ${data.salon || 'Por asignar'}</p>
              <p><strong>Personas:</strong> ${data.people}</p>
              <p><strong>Estado:</strong> CONFIRMADA</p>
            </div>

            <div style="margin: 25px 0;">
              <p><strong>Recordatorios importantes:</strong></p>
              <ul style="color: #4A3429; padding-left: 20px;">
                <li style="margin: 8px 0;">Por favor llegue puntual a su reserva</li>
                <li style="margin: 8px 0;">La mesa se mantiene hasta 30 minutos después de la hora acordada</li>
                <li style="margin: 8px 0;">El anticipo será descontado de su cuenta final</li>
              </ul>
            </div>

            <p style="text-align: center; color: #6B4C3B; font-style: italic; margin-top: 30px;">
              Esperamos brindarle una experiencia gastronómica inolvidable.
            </p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #D4C4AA; text-align: center;">
              <h3 style="color: #6B4C3B; margin-bottom: 10px;">Ubicación</h3>
              <p style="margin: 5px 0; color: #4A3429;">
                Cra 35a #46-102, Barrio Cabecera del Llano<br>
                Bucaramanga, Colombia<br>
                Teléfono: 300 826 3403
              </p>
            </div>
          </div>

          <div class="footer">
            <p class="restaurant-name">MAR Y TIERRA RESTAURANT</p>
            <p>Instagram: @marytierrarestaurantbga</p>
            <p style="font-size: 11px; margin-top: 10px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Mar y Tierra Restaurant. Todos los derechos reservados.</p>
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
 * Diseño elegante Mar y Tierra - Incluye datos bancarios
 */
function sendReminderEmail(data) {
  try {
    const subject = 'Recordatorio: Complete su Reserva - Mar y Tierra Restaurant';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #4A3429;
            background: #F5EFE6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #FDFBF7;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(74, 52, 41, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4A3429, #6B4C3B);
            color: #FDFBF7;
            padding: 45px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 400;
            letter-spacing: 3px;
            text-transform: uppercase;
          }
          .header .subtitle {
            margin: 15px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
            letter-spacing: 1px;
          }
          .header .divider {
            width: 60px;
            height: 2px;
            background: #C9A961;
            margin: 20px auto 0;
          }
          .content { padding: 40px 35px; }
          .reminder-box {
            background: linear-gradient(135deg, #F5EFE6, #FDFBF7);
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            border: 2px solid #C9A961;
          }
          .reminder-box p {
            margin: 10px 0;
            color: #4A3429;
          }
          .amount {
            font-size: 26px;
            color: #6B4C3B;
            font-weight: 600;
            margin: 15px 0;
          }
          .payment-section {
            background: #F5EFE6;
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #C9A961;
          }
          .payment-section h3 {
            color: #6B4C3B;
            margin-top: 0;
            font-weight: 600;
          }
          .bank-details {
            background: #FDFBF7;
            padding: 20px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #D4C4AA;
          }
          .bank-details p {
            margin: 8px 0;
            color: #4A3429;
          }
          .whatsapp-section {
            margin-top: 25px;
            padding: 20px;
            background: #FDFBF7;
            border-radius: 8px;
            border: 1px solid #D4C4AA;
          }
          .whatsapp-link {
            color: #25D366;
            font-weight: bold;
            text-decoration: none;
          }
          .important-notice {
            background: #6B4C3B;
            color: #FDFBF7;
            padding: 12px 15px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 13px;
          }
          .footer {
            background: #4A3429;
            color: #D4C4AA;
            padding: 35px 30px;
            text-align: center;
          }
          .footer p { margin: 5px 0; }
          .footer .restaurant-name {
            color: #C9A961;
            font-size: 16px;
            letter-spacing: 2px;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mar y Tierra</h1>
            <p class="subtitle">Restaurant</p>
            <div class="divider"></div>
          </div>

          <div class="content">
            <p style="font-size: 18px;">Estimado/a <strong>${data.name}</strong>,</p>

            <div class="reminder-box">
              <p style="font-size: 16px;"><strong>Su reserva para el ${formatDate(data.date)} está pendiente de confirmación.</strong></p>
              <p>Anticipo requerido:</p>
              <p class="amount">${data.totalDeposit}</p>
              <p>Por favor complete el pago lo antes posible para garantizar su reserva.</p>
            </div>

            <div class="payment-section">
              <h3>Datos para realizar el pago</h3>
              <div class="bank-details">
                <p><strong>Banco:</strong> Bancolombia</p>
                <p><strong>Tipo de Cuenta:</strong> Cuenta Corriente</p>
                <p><strong>Número de Cuenta:</strong> 30200003995</p>
                <p><strong>NIT:</strong> 901857854</p>
                <p><strong>Titular:</strong> MYT RESTAURANT SAS</p>
              </div>
            </div>

            <div class="whatsapp-section">
              <p style="margin-top: 0;">Si ya realizó el pago, envíe el comprobante al WhatsApp:</p>
              <p style="font-size: 18px; margin: 15px 0;">
                <a href="https://wa.me/573008263403?text=Hola%2C%20adjunto%20comprobante%20de%20pago%20para%20mi%20reserva"
                   class="whatsapp-link">+57 300 826 3403</a>
              </p>
              <div class="important-notice">
                Este número es <strong>únicamente</strong> para enviar comprobantes de pago. No se realizan reservas por este medio.
              </div>
            </div>
          </div>

          <div class="footer">
            <p class="restaurant-name">MAR Y TIERRA RESTAURANT</p>
            <p>Cra 35a #46-102, Cabecera del Llano</p>
            <p>Bucaramanga, Colombia</p>
            <p style="font-size: 11px; margin-top: 10px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Mar y Tierra Restaurant. Todos los derechos reservados.</p>
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
 * Diseño elegante Mar y Tierra
 */
function sendFinalConfirmationEmail(data) {
  try {
    const subject = 'Confirmación Final de Reserva - Mar y Tierra Restaurant';

    const decorationDetails = getDecorationDetails(data.decorationPlan);
    const servicesDetails = getServicesDetails(data.services);

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #4A3429;
            background: #F5EFE6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #FDFBF7;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(74, 52, 41, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4A3429, #6B4C3B);
            color: #FDFBF7;
            padding: 50px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 400;
            letter-spacing: 3px;
            text-transform: uppercase;
          }
          .header .subtitle {
            margin: 15px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
            letter-spacing: 1px;
          }
          .header .divider {
            width: 60px;
            height: 2px;
            background: #C9A961;
            margin: 20px auto 0;
          }
          .content { padding: 40px 35px; }
          .reservation-card {
            background: #F5EFE6;
            padding: 30px;
            border-radius: 8px;
            margin: 30px 0;
            border: 1px solid #D4C4AA;
          }
          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .detail-item {
            padding: 15px;
            background: #FDFBF7;
            border-radius: 6px;
            border-left: 3px solid #C9A961;
          }
          .detail-label {
            font-size: 11px;
            color: #8B8680;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          .detail-value {
            font-size: 15px;
            color: #4A3429;
            font-weight: 600;
          }
          .services-section {
            background: #FDFBF7;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #D4C4AA;
          }
          .services-section h4 {
            color: #6B4C3B;
            margin-top: 0;
          }
          .code-box {
            text-align: center;
            margin: 30px 0;
            padding: 25px;
            background: #F5EFE6;
            border-radius: 8px;
          }
          .code-display {
            background: #FDFBF7;
            padding: 20px 30px;
            display: inline-block;
            border: 2px solid #C9A961;
            border-radius: 8px;
          }
          .code-display strong {
            font-size: 24px;
            color: #6B4C3B;
            letter-spacing: 2px;
          }
          .important-note {
            background: #F5EFE6;
            border-left: 4px solid #C9A961;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
          }
          .important-note strong {
            color: #6B4C3B;
          }
          .important-note ul {
            margin: 15px 0 0 0;
            padding-left: 20px;
            color: #4A3429;
          }
          .important-note li {
            margin: 8px 0;
          }
          .footer {
            background: #4A3429;
            color: #D4C4AA;
            padding: 40px 30px;
            text-align: center;
          }
          .footer h3 {
            color: #FDFBF7;
            margin-top: 0;
            font-weight: 400;
          }
          .footer p { margin: 5px 0; }
          .footer .restaurant-name {
            color: #C9A961;
            font-size: 16px;
            letter-spacing: 2px;
            margin: 20px 0 15px 0;
          }
          .gold-badge {
            display: inline-block;
            background: linear-gradient(135deg, #C9A961, #8B7355);
            color: #FDFBF7;
            padding: 6px 18px;
            border-radius: 20px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 15px 0 0 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mar y Tierra</h1>
            <p class="subtitle">Restaurant</p>
            <div class="divider"></div>
            ${data.reservationType === 'salon-gold' ? '<span class="gold-badge">Salón Gold</span>' : ''}
          </div>

          <div class="content">
            <p style="font-size: 20px; text-align: center; color: #6B4C3B;">
              Estimado/a <strong>${data.name}</strong>
            </p>

            <p style="text-align: center; color: #8B8680;">
              Nos complace confirmar todos los detalles de su reserva
            </p>

            <div class="reservation-card">
              <h3 style="margin-top: 0; color: #6B4C3B; font-weight: 500;">Detalles de la Reserva</h3>

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
                  <div class="detail-value">${formatTime(data.time)}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Salón</div>
                  <div class="detail-value">${data.salon || 'Por asignar'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Número de Personas</div>
                  <div class="detail-value">${data.people} personas</div>
                </div>
              </div>

              ${decorationDetails || servicesDetails ? `
              <div class="services-section">
                <h4>Servicios Especiales Confirmados</h4>
                ${decorationDetails ? decorationDetails : ''}
                ${servicesDetails ? servicesDetails : ''}
              </div>
              ` : ''}

              ${data.comments && data.comments !== 'Sin comentarios' ? `
              <div class="important-note" style="margin-top: 20px;">
                <strong>Notas Especiales:</strong><br>
                <span style="margin-top: 10px; display: block;">${data.comments}</span>
              </div>
              ` : ''}
            </div>

            <div class="important-note">
              <strong>Recordatorios Importantes</strong>
              <ul>
                <li>Por favor llegue puntual a su reserva</li>
                <li>La mesa se garantiza hasta 30 minutos después de la hora acordada</li>
                <li>El anticipo de ${data.totalDeposit} será descontado de su cuenta final</li>
                ${data.reservationType === 'salon-gold' ? '<li>Acceso exclusivo al Salón Gold con atención personalizada</li>' : ''}
              </ul>
            </div>

            <div class="code-box">
              <p style="color: #8B8680; margin: 0 0 15px 0;">Muestre este código al llegar:</p>
              <div class="code-display">
                <strong>${data.id}</strong>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0; padding-top: 20px; border-top: 1px solid #D4C4AA;">
              <h3 style="color: #6B4C3B; margin-bottom: 15px;">Ubicación</h3>
              <p style="color: #4A3429; margin: 5px 0;">
                Cra 35a #46-102, Barrio Cabecera del Llano<br>
                Bucaramanga, Colombia<br>
                Teléfono: 300 826 3403
              </p>
            </div>
          </div>

          <div class="footer">
            <h3>Le esperamos</h3>
            <p style="color: #D4C4AA;">Prepárese para una experiencia gastronómica inolvidable</p>
            <p class="restaurant-name">MAR Y TIERRA RESTAURANT</p>
            <p>Instagram: @marytierrarestaurantbga</p>
            <p style="font-size: 11px; margin-top: 15px; opacity: 0.7;">
              Este es un correo de confirmación automático. Guárdelo para su referencia.
            </p>
            <p style="font-size: 11px; opacity: 0.7;">&copy; ${new Date().getFullYear()} Mar y Tierra Restaurant. Todos los derechos reservados.</p>
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
    const subject = `Nueva Reserva - ${data.name} - ${formatDate(data.date)} ${data.time}`;
    
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
            <h2>Nueva Reserva Recibida</h2>
            <p>${data.reservationType === 'especial' || data.reservationType === 'salon-gold' ? 'RESERVA ESPECIAL' : ''}</p>
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
              <span class="label">Hora:</span> ${formatTime(data.time)}
            </div>
            <div class="detail-row">
              <span class="label">Salón:</span> ${data.salon || 'Por asignar'}
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
                Ver en Google Sheets
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
function formatDate(dateInput) {
  // Validar entrada
  if (!dateInput) {
    return 'Fecha no especificada';
  }

  let date;

  // Si ya es un objeto Date
  if (dateInput instanceof Date) {
    date = dateInput;
  }
  // Si es un string
  else if (typeof dateInput === 'string') {
    // Intentar parsear la fecha
    // Formato esperado: YYYY-MM-DD
    if (dateInput.includes('-')) {
      const parts = dateInput.split('-');
      if (parts.length === 3) {
        // Crear fecha usando partes individuales para evitar problemas de timezone
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }
  } else {
    return 'Fecha inválida';
  }

  // Verificar que la fecha sea válida
  if (isNaN(date.getTime())) {
    return 'Fecha inválida';
  }

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
 * Formatea la hora para mostrar
 */
function formatTime(timeInput) {
  // Validar entrada
  if (!timeInput) {
    return 'Hora no especificada';
  }

  // Si es un string con formato HH:MM
  if (typeof timeInput === 'string' && timeInput.includes(':')) {
    return timeInput;
  }

  // Si es un objeto Date
  if (timeInput instanceof Date && !isNaN(timeInput.getTime())) {
    const hours = timeInput.getHours();
    const minutes = timeInput.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Intentar convertir a string
  const timeStr = String(timeInput);

  // Si contiene información de hora antigua (1899), solo extraer la hora
  if (timeStr.includes('1899')) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
  }

  return timeStr;
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
    const estado = data[i][14]; // Columna de Estado (índice 14)
    const anticipo = data[i][12]; // Columna de Anticipo (índice 12)
    
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

// ============================================
// MEJORAS CRÍTICAS - SISTEMA DE RESERVAS
// ============================================

/**
 * Envía recordatorios automáticos 24 horas antes de la reserva
 * Se ejecuta cada hora para verificar reservas del día siguiente
 */
function checkAndSendReminders() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    // Obtener fecha de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = Utilities.formatDate(tomorrow, 'America/Bogota', 'yyyy-MM-dd');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const reservationDate = row[6]; // Columna de Fecha (índice 6)
      const status = row[14]; // Columna de Estado (índice 14)
      const paymentStatus = row[15]; // Estado de Pago (índice 15)
      const reminderSent = row[17]; // Columna de Recordatorios Enviados (índice 17)
      const email = row[4]; // Email
      const name = row[2]; // Nombre
      const time = row[7]; // Hora (índice 7)
      const people = row[8]; // Personas (índice 8)
      const reservationId = row[0]; // ID

      // Formatear fecha de reserva para comparar
      let dateStr = '';
      if (reservationDate instanceof Date) {
        dateStr = Utilities.formatDate(reservationDate, 'America/Bogota', 'yyyy-MM-dd');
      } else if (typeof reservationDate === 'string') {
        dateStr = reservationDate.split('T')[0];
      }

      // Solo enviar si: es para mañana, está confirmada, y no se ha enviado recordatorio
      if (dateStr === tomorrowStr &&
          (status === 'Confirmada' || paymentStatus === 'Confirmado') &&
          reminderSent !== 'Recordatorio 24h enviado') {

        // Enviar email de recordatorio
        sendReservationReminderEmail({
          email: email,
          name: name,
          date: reservationDate,
          time: time,
          people: people,
          id: reservationId
        });

        // Marcar como enviado
        sheet.getRange(i + 1, 17).setValue('Recordatorio 24h enviado');
        sheet.getRange(i + 1, 18).setValue(new Date());
      }
    }

    console.log('Verificación de recordatorios completada: ' + new Date().toISOString());
  } catch (error) {
    console.error('Error en checkAndSendReminders:', error);
  }
}

/**
 * Envía email de recordatorio 24h antes
 */
function sendReservationReminderEmail(data) {
  try {
    const subject = '⏰ Recordatorio: Su reserva es MAÑANA - Mar&Tierra Restaurant';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #0056D2, #D4AF37); color: white; padding: 40px; text-align: center; }
          .content { background: white; padding: 40px; }
          .reminder-box { background: #e8f4fd; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0; border: 2px solid #0056D2; }
          .details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #2c3e50; color: white; padding: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ ¡Su reserva es mañana!</h1>
            <p>Le esperamos con los brazos abiertos</p>
          </div>

          <div class="content">
            <p>Estimado/a <strong>${data.name}</strong>,</p>

            <div class="reminder-box">
              <h2 style="color: #0056D2; margin: 0;">Mañana es su reserva</h2>
              <p style="font-size: 18px; margin: 10px 0;">
                📅 ${formatDate(data.date)} a las 🕐 ${formatTime(data.time)}
              </p>
              <p>📍 <strong>${data.salon || 'Salón por confirmar'}</strong></p>
              <p>👥 Mesa para <strong>${data.people} personas</strong></p>
            </div>

            <div class="details">
              <h3>📋 Código de Reserva:</h3>
              <p style="font-size: 20px; color: #0056D2; font-weight: bold;">${data.id}</p>
            </div>

            <h3>📍 Ubicación:</h3>
            <p>
              <strong>Mar&Tierra Restaurant</strong><br>
              Cra 35a #46-102, Barrio Cabecera del Llano<br>
              Bucaramanga, Colombia<br>
              📞 300 826 3403
            </p>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Recordatorios importantes:</strong>
              <ul style="margin: 10px 0;">
                <li>Por favor llegue puntual a su reserva</li>
                <li>La mesa se mantiene máximo 30 minutos después de la hora acordada</li>
                <li>Presente su código de reserva al llegar</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>¡Lo esperamos para una experiencia gastronómica inolvidable!</p>
            <p style="margin: 5px;">© ${new Date().getFullYear()} Mar&Tierra Restaurant</p>
            <p style="font-size: 12px;">Instagram: @marytierrarestaurantbga</p>
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

    console.log('Recordatorio enviado a: ' + data.email);
  } catch (error) {
    console.error('Error sending reminder email:', error);
  }
}

/**
 * Envía resumen diario de reservas al restaurante
 * Se ejecuta todos los días a las 7:00 AM (hora Colombia)
 */
function sendDailySummary() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // No hay reservas
      return;
    }

    // Obtener fecha de hoy
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'America/Bogota', 'yyyy-MM-dd');

    // Filtrar reservas de hoy
    let reservasHoy = [];
    let totalPersonas = 0;
    let pendientesPago = 0;
    let confirmadas = 0;
    let serviciosEspeciales = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const reservationDate = row[5];

      let dateStr = '';
      if (reservationDate instanceof Date) {
        dateStr = Utilities.formatDate(reservationDate, 'America/Bogota', 'yyyy-MM-dd');
      } else if (typeof reservationDate === 'string') {
        dateStr = reservationDate.split('T')[0];
      }

      if (dateStr === todayStr) {
        reservasHoy.push({
          id: row[0],
          hora: row[6],
          nombre: row[2],
          telefono: row[3],
          personas: row[8],  // índice 8
          tipo: row[9],      // índice 9
          decoracion: row[10], // índice 10
          servicios: row[11],  // índice 11
          anticipo: row[12],   // índice 12
          estado: row[14],     // índice 14
          estadoPago: row[15]  // índice 15
        });

        totalPersonas += parseInt(row[8]) || 0;

        if (row[15] === 'Confirmado') {  // Estado Pago está en índice 15
          confirmadas++;
        } else {
          pendientesPago++;
        }

        if (row[11] && row[11] !== 'Ninguno') {  // Servicios está en índice 11
          serviciosEspeciales.push(`${row[2]}: ${row[11]}`);
        }
      }
    }

    // Si no hay reservas hoy, enviar resumen vacío
    if (reservasHoy.length === 0) {
      const htmlBody = `
        <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>📅 Resumen del Día - ${formatDate(today)}</h2>
          <p style="color: #666;">No hay reservas programadas para hoy.</p>
          <p>Buen día!</p>
        </body>
        </html>
      `;

      MailApp.sendEmail({
        to: RESTAURANT_EMAIL,
        subject: `📅 Resumen del Día - Sin reservas - ${Utilities.formatDate(today, 'America/Bogota', 'dd/MM/yyyy')}`,
        htmlBody: htmlBody
      });
      return;
    }

    // Ordenar por hora
    reservasHoy.sort((a, b) => {
      const horaA = a.hora ? a.hora.toString() : '';
      const horaB = b.hora ? b.hora.toString() : '';
      return horaA.localeCompare(horaB);
    });

    // Generar tabla HTML
    let tablaHTML = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #0056D2; color: white;">
            <th style="padding: 12px; border: 1px solid #ddd;">Hora</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Cliente</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Teléfono</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Personas</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Tipo</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Estado Pago</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Anticipo</th>
          </tr>
        </thead>
        <tbody>
    `;

    reservasHoy.forEach(r => {
      const bgColor = r.estadoPago === 'Confirmado' ? '#d4edda' : '#fff3cd';
      tablaHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #ddd;">${formatTime(r.hora)}</td>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>${r.nombre}</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${r.telefono}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${r.personas}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${formatReservationType(r.tipo)}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">
            ${r.estadoPago === 'Confirmado' ? '✅ Confirmado' : '⚠️ Pendiente'}
          </td>
          <td style="padding: 10px; border: 1px solid #ddd;">${r.anticipo}</td>
        </tr>
      `;
    });

    tablaHTML += '</tbody></table>';

    // Servicios especiales
    let serviciosHTML = '';
    if (serviciosEspeciales.length > 0) {
      serviciosHTML = `
        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">🎵 Servicios Especiales del Día:</h3>
          <ul>
            ${serviciosEspeciales.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #D4AF37, #B8860B); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">📅 Resumen del Día</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">${formatDate(today)}</p>
          </div>

          <div style="background: white; padding: 30px; border: 1px solid #ddd;">
            <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 30px; flex-wrap: wrap;">
              <div style="padding: 20px; background: #f8f9fa; border-radius: 10px; margin: 10px; min-width: 150px;">
                <div style="font-size: 36px; color: #0056D2; font-weight: bold;">${reservasHoy.length}</div>
                <div>Reservas Totales</div>
              </div>
              <div style="padding: 20px; background: #d4edda; border-radius: 10px; margin: 10px; min-width: 150px;">
                <div style="font-size: 36px; color: #28a745; font-weight: bold;">${confirmadas}</div>
                <div>Confirmadas</div>
              </div>
              <div style="padding: 20px; background: #fff3cd; border-radius: 10px; margin: 10px; min-width: 150px;">
                <div style="font-size: 36px; color: #856404; font-weight: bold;">${pendientesPago}</div>
                <div>Pendientes de Pago</div>
              </div>
              <div style="padding: 20px; background: #e8f4fd; border-radius: 10px; margin: 10px; min-width: 150px;">
                <div style="font-size: 36px; color: #0056D2; font-weight: bold;">${totalPersonas}</div>
                <div>Personas Esperadas</div>
              </div>
            </div>

            <h2>📋 Detalle de Reservas</h2>
            ${tablaHTML}

            ${serviciosHTML}

            ${pendientesPago > 0 ? `
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <strong>⚠️ Atención:</strong> Hay ${pendientesPago} reserva(s) pendiente(s) de confirmación de pago.
              Por favor verificar antes de que lleguen los clientes.
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}"
                 style="background: #0056D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver en Google Sheets
              </a>
            </div>
          </div>

          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">¡Que tengan un excelente día de servicio!</p>
            <p style="margin: 5px 0; font-size: 12px;">Mar&Tierra Restaurant - Sistema de Reservas</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `📅 Resumen: ${reservasHoy.length} reservas para hoy (${totalPersonas} personas) - ${Utilities.formatDate(today, 'America/Bogota', 'dd/MM/yyyy')}`;

    MailApp.sendEmail({
      to: RESTAURANT_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });

    // Enviar a emails adicionales
    if (ADDITIONAL_EMAILS && ADDITIONAL_EMAILS !== 'gerencia@example.com,eventos@example.com') {
      const additionalEmails = ADDITIONAL_EMAILS.split(',').map(email => email.trim());
      additionalEmails.forEach(email => {
        if (email && email !== '') {
          MailApp.sendEmail({
            to: email,
            subject: subject,
            htmlBody: htmlBody
          });
        }
      });
    }

    console.log('Resumen diario enviado: ' + new Date().toISOString());
  } catch (error) {
    console.error('Error en sendDailySummary:', error);
  }
}

/**
 * Aplica formato condicional mejorado a la hoja de reservas
 */
function applyConditionalFormatting() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      SpreadsheetApp.getUi().alert('No se encontró la hoja de reservas.');
      return;
    }

    // Limpiar reglas existentes
    sheet.clearConditionalFormatRules();

    const lastRow = Math.max(sheet.getLastRow(), 2);
    const lastColumn = sheet.getLastColumn();
    const range = sheet.getRange(2, 1, lastRow - 1, lastColumn);

    const rules = [];

    // Regla 1: Pago Confirmado = Verde claro
    const ruleConfirmado = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Confirmado')
      .setBackground('#d4edda')
      .setRanges([sheet.getRange(2, 15, lastRow - 1, 1)]) // Columna Estado Pago
      .build();
    rules.push(ruleConfirmado);

    // Regla 2: Pago Pendiente = Amarillo
    const rulePendiente = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Por verificar')
      .setBackground('#fff3cd')
      .setRanges([sheet.getRange(2, 15, lastRow - 1, 1)])
      .build();
    rules.push(rulePendiente);

    // Regla 3: Estado Cancelada = Rojo claro
    const ruleCancelada = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Cancelada')
      .setBackground('#f8d7da')
      .setRanges([sheet.getRange(2, 14, lastRow - 1, 1)]) // Columna Estado
      .build();
    rules.push(ruleCancelada);

    // Regla 4: Estado Completada = Gris
    const ruleCompletada = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Completada')
      .setBackground('#e9ecef')
      .setRanges([sheet.getRange(2, 14, lastRow - 1, 1)])
      .build();
    rules.push(ruleCompletada);

    // Aplicar reglas
    sheet.setConditionalFormatRules(rules);

    // También aplicar colores a filas completas basado en el estado de pago
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const estadoPago = data[i][15]; // Estado Pago (índice 15)
      const estado = data[i][14];     // Estado (índice 14)

      if (estado === 'Cancelada') {
        sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#f8d7da');
      } else if (estado === 'Completada') {
        sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#e9ecef');
      } else if (estadoPago === 'Confirmado') {
        sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#d4edda');
      } else {
        // Verificar si tiene más de 48 horas pendiente
        const fechaRegistro = data[i][19]; // Fecha Registro (índice 19)
        if (fechaRegistro) {
          const ahora = new Date();
          const registro = new Date(fechaRegistro);
          const horasDiferencia = (ahora - registro) / (1000 * 60 * 60);

          if (horasDiferencia > 48) {
            sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#f8d7da'); // Rojo - urgente
          } else {
            sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#fff3cd'); // Amarillo - normal
          }
        }
      }
    }

    SpreadsheetApp.getUi().alert('✅ Formato condicional aplicado correctamente.\n\n' +
      '🟢 Verde: Pago confirmado\n' +
      '🟡 Amarillo: Pendiente de pago (<48h)\n' +
      '🔴 Rojo claro: Urgente (>48h) o Cancelada\n' +
      '⚪ Gris: Completada');

  } catch (error) {
    console.error('Error aplicando formato condicional:', error);
    SpreadsheetApp.getUi().alert('Error: ' + error.toString());
  }
}

/**
 * Configura el trigger para recordatorios automáticos
 */
function setupReminderTrigger() {
  // Eliminar triggers existentes de recordatorios
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkAndSendReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Crear nuevo trigger cada hora
  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert('✅ Recordatorios automáticos configurados.\n\n' +
    'El sistema verificará cada hora si hay reservas para el día siguiente y enviará recordatorios automáticamente.');
}

/**
 * Configura el trigger para resumen diario
 */
function setupDailySummaryTrigger() {
  // Eliminar triggers existentes de resumen diario
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailySummary') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Crear nuevo trigger a las 7:00 AM Colombia
  ScriptApp.newTrigger('sendDailySummary')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone('America/Bogota')
    .create();

  SpreadsheetApp.getUi().alert('✅ Resumen diario configurado.\n\n' +
    'El sistema enviará un email a las 7:00 AM (hora Colombia) con el resumen de reservas del día.');
}

/**
 * Marcar reserva como completada (cliente ya asistió)
 */
function markAsCompleted() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const row = range.getRow();

  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Por favor seleccione una reserva válida.');
    return;
  }

  sheet.getRange(row, 14).setValue('Completada'); // Estado
  sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground('#e9ecef');

  SpreadsheetApp.getUi().alert('✅ Reserva marcada como completada.');
}

/**
 * Cancelar una reserva
 */
function cancelReservation() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const row = range.getRow();

  if (row <= 1) {
    ui.alert('Por favor seleccione una reserva válida.');
    return;
  }

  const response = ui.alert('Confirmar Cancelación',
    '¿Está seguro de que desea cancelar esta reserva?',
    ui.ButtonSet.YES_NO);

  if (response === ui.Button.YES) {
    sheet.getRange(row, 14).setValue('Cancelada'); // Estado
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground('#f8d7da');

    // Enviar email de cancelación al cliente
    const email = sheet.getRange(row, 5).getValue();
    const name = sheet.getRange(row, 3).getValue();

    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: '❌ Reserva Cancelada - Mar&Tierra Restaurant',
        htmlBody: `
          <p>Estimado/a ${name},</p>
          <p>Le informamos que su reserva ha sido cancelada.</p>
          <p>Si tiene alguna pregunta, contáctenos al 300 826 3403.</p>
          <p>Saludos,<br>Mar&Tierra Restaurant</p>
        `
      });
    }

    ui.alert('✅ Reserva cancelada y cliente notificado.');
  }
}