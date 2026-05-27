// =====================================================================
// Mar&Tierra — Mi Reserva (customer self-service)
// =====================================================================

const STATUS_LABELS = {
    pending: 'Pendiente de pago',
    confirmed: 'Confirmada',
    seated: 'En mesa',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No se presento'
};

const TYPE_LABELS = { free: 'Reserva Free', plata: 'Plan Plata', oro: 'Plan Oro', luxury: 'Plan Luxury' };

const HOURS = {
    0: { open: '11:30', close: '21:00' },
    1: { open: '11:30', close: '22:00' },
    2: { open: '11:30', close: '23:00' },
    3: { open: '11:30', close: '23:00' },
    4: { open: '11:30', close: '23:00' },
    5: { open: '11:30', close: '00:00' },
    6: { open: '11:30', close: '00:00' }
};

let currentReservation = null;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPrice(amount) {
    return '$' + (amount || 0).toLocaleString('es-CO');
}

function toLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function generateTimeSlots(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    const h = HOURS[day];
    if (!h) return [];
    const slots = [];
    const [oh, om] = h.open.split(':').map(Number);
    const [ch, cm] = h.close.split(':').map(Number);
    let end = ch * 60 + cm;
    if (end === 0) end = 24 * 60;
    end -= 60;
    for (let min = oh * 60 + om; min <= end; min += 30) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
    }
    return slots;
}

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ================================================================
// SEARCH
// ================================================================

async function searchReservation() {
    const code = document.getElementById('mr-code').value.trim();
    const errorEl = document.getElementById('mr-error');
    const btn = document.getElementById('mr-search-btn');

    if (!code) { errorEl.textContent = 'Ingresa un codigo de reserva'; errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'BUSCANDO...';

    try {
        const { data, error } = await sb.rpc('get_reservation_by_code', { p_code: code });
        if (error) throw error;
        if (!data?.success) {
            errorEl.textContent = data?.error || 'Reserva no encontrada';
            errorEl.style.display = 'block';
            return;
        }
        currentReservation = data.reservation;
        showDetail();
    } catch (e) {
        errorEl.textContent = 'Error de conexion. Intenta de nuevo.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'CONSULTAR';
    }
}

// ================================================================
// DETAIL VIEW
// ================================================================

function showDetail() {
    const r = currentReservation;
    document.getElementById('mr-search').style.display = 'none';
    document.getElementById('mr-detail').style.display = 'block';
    document.getElementById('mr-modify').style.display = 'none';
    document.getElementById('mr-cancel-confirm').style.display = 'none';
    document.getElementById('mr-success-msg').style.display = 'none';
    document.getElementById('mr-error-detail').style.display = 'none';

    const statusBar = document.getElementById('mr-status-bar');
    statusBar.textContent = STATUS_LABELS[r.status] || r.status;
    statusBar.className = 'mr-status-bar mr-status-' + r.status;

    document.getElementById('mr-code-display').textContent = r.code;

    const date = new Date(r.date + 'T12:00:00').toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let gridHtml = `
        <div><div class="mr-item-label">Fecha</div><div class="mr-item-value">${escapeHtml(date)}</div></div>
        <div><div class="mr-item-label">Hora</div><div class="mr-item-value">${formatTime(r.time)}</div></div>
        <div><div class="mr-item-label">Personas</div><div class="mr-item-value">${r.party_size}</div></div>
        <div><div class="mr-item-label">Salon</div><div class="mr-item-value">${escapeHtml(r.salon_name)}</div></div>
        <div><div class="mr-item-label">Experiencia</div><div class="mr-item-value">${TYPE_LABELS[r.type] || r.type}</div></div>
        <div><div class="mr-item-label">Anticipo</div><div class="mr-item-value">${formatPrice(r.deposit_amount)} ${r.is_consumable ? '(consumible)' : '(no consumible)'}</div></div>
        <div><div class="mr-item-label">Cliente</div><div class="mr-item-value">${escapeHtml(r.customer_name)}</div></div>
        <div><div class="mr-item-label">Telefono</div><div class="mr-item-value">Registrado</div></div>
    `;
    if (r.special_requests) {
        gridHtml += `<div class="mr-item-full"><div class="mr-item-label">Solicitudes</div><div class="mr-item-value">${escapeHtml(r.special_requests)}</div></div>`;
    }
    if (r.cancellation_reason) {
        gridHtml += `<div class="mr-item-full"><div class="mr-item-label">Razon de cancelacion</div><div class="mr-item-value">${escapeHtml(r.cancellation_reason)}</div></div>`;
    }
    document.getElementById('mr-info-grid').innerHTML = gridHtml;

    const canModify = ['pending', 'confirmed'].includes(r.status);
    const modsLeft = 2 - (r.modifications_used || 0);
    document.getElementById('mr-actions-section').style.display = canModify ? 'block' : 'none';

    const modBtn = document.getElementById('mr-modify-btn');
    if (modBtn && canModify) {
        if (modsLeft <= 0) {
            modBtn.textContent = 'Limite de modificaciones alcanzado';
            modBtn.disabled = true;
            modBtn.style.opacity = '0.4';
        } else {
            modBtn.textContent = `Modificar fecha u hora (${modsLeft} cambio${modsLeft === 1 ? '' : 's'} restante${modsLeft === 1 ? '' : 's'})`;
            modBtn.disabled = false;
            modBtn.style.opacity = '1';
        }
    }
}

// ================================================================
// MODIFY
// ================================================================

function showModifyForm() {
    document.getElementById('mr-modify').style.display = 'block';
    document.getElementById('mr-cancel-confirm').style.display = 'none';
    document.getElementById('mr-actions-section').style.display = 'none';

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);

    document.getElementById('mr-new-date').min = toLocalDate(minDate);
    document.getElementById('mr-new-date').max = toLocalDate(maxDate);
    document.getElementById('mr-new-date').value = '';
    document.getElementById('mr-new-time').innerHTML = '<option value="">Selecciona fecha primero</option>';
    document.getElementById('mr-modify-phone').value = '';
}

function onModifyDateChange() {
    const dateStr = document.getElementById('mr-new-date').value;
    const timeSelect = document.getElementById('mr-new-time');
    if (!dateStr) {
        timeSelect.innerHTML = '<option value="">Selecciona fecha primero</option>';
        return;
    }
    const slots = generateTimeSlots(dateStr);
    timeSelect.innerHTML = '<option value="">Selecciona hora</option>' +
        slots.map(t => `<option value="${t}">${formatTime(t)}</option>`).join('');
}

async function confirmModify() {
    const newDate = document.getElementById('mr-new-date').value;
    const newTime = document.getElementById('mr-new-time').value;
    const phone = document.getElementById('mr-modify-phone').value.trim();
    const errorEl = document.getElementById('mr-error-detail');
    const successEl = document.getElementById('mr-success-msg');
    const btn = document.getElementById('mr-confirm-modify');

    if (!newDate || !newTime || phone.length !== 4) {
        errorEl.textContent = 'Completa todos los campos (fecha, hora, 4 digitos de telefono)';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'MODIFICANDO...';

    try {
        const { data, error } = await sb.rpc('customer_modify_reservation', {
            p_code: currentReservation.code,
            p_phone: phone,
            p_new_date: newDate,
            p_new_time: newTime
        });
        if (error) throw error;
        if (!data?.success) {
            errorEl.textContent = data?.error || 'No se pudo modificar la reserva';
            errorEl.style.display = 'block';
            return;
        }
        successEl.textContent = 'Reserva modificada exitosamente';
        successEl.style.display = 'block';
        document.getElementById('mr-modify').style.display = 'none';

        // Reload
        const { data: fresh } = await sb.rpc('get_reservation_by_code', { p_code: currentReservation.code });
        if (fresh?.success) { currentReservation = fresh.reservation; showDetail(); }
        successEl.style.display = 'block';
    } catch (e) {
        errorEl.textContent = 'Error de conexion. Intenta de nuevo.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'CONFIRMAR CAMBIO';
    }
}

// ================================================================
// CANCEL
// ================================================================

function showCancelForm() {
    document.getElementById('mr-cancel-confirm').style.display = 'block';
    document.getElementById('mr-modify').style.display = 'none';
    document.getElementById('mr-actions-section').style.display = 'none';
    document.getElementById('mr-cancel-phone').value = '';
}

async function confirmCancel() {
    const phone = document.getElementById('mr-cancel-phone').value.trim();
    const errorEl = document.getElementById('mr-error-detail');
    const successEl = document.getElementById('mr-success-msg');
    const btn = document.getElementById('mr-confirm-cancel');

    if (phone.length !== 4) {
        errorEl.textContent = 'Ingresa los ultimos 4 digitos de tu telefono';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'CANCELANDO...';

    try {
        const { data, error } = await sb.rpc('customer_cancel_reservation', {
            p_code: currentReservation.code,
            p_phone: phone
        });
        if (error) throw error;
        if (!data?.success) {
            errorEl.textContent = data?.error || 'No se pudo cancelar';
            errorEl.style.display = 'block';
            return;
        }
        successEl.textContent = 'Reserva cancelada exitosamente';
        successEl.style.display = 'block';
        document.getElementById('mr-cancel-confirm').style.display = 'none';

        const { data: fresh } = await sb.rpc('get_reservation_by_code', { p_code: currentReservation.code });
        if (fresh?.success) { currentReservation = fresh.reservation; showDetail(); }
        successEl.style.display = 'block';
    } catch (e) {
        errorEl.textContent = 'Error de conexion. Intenta de nuevo.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'SI, CANCELAR MI RESERVA';
    }
}

// ================================================================
// EVENTS
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check URL param
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
        document.getElementById('mr-code').value = code;
        searchReservation();
    }

    document.getElementById('mr-search-btn').addEventListener('click', searchReservation);
    document.getElementById('mr-code').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchReservation();
    });

    document.getElementById('mr-modify-btn').addEventListener('click', showModifyForm);
    document.getElementById('mr-cancel-btn').addEventListener('click', showCancelForm);
    document.getElementById('mr-confirm-modify').addEventListener('click', confirmModify);
    document.getElementById('mr-cancel-modify').addEventListener('click', () => {
        document.getElementById('mr-modify').style.display = 'none';
        document.getElementById('mr-actions-section').style.display = 'block';
    });
    document.getElementById('mr-confirm-cancel').addEventListener('click', confirmCancel);
    document.getElementById('mr-abort-cancel').addEventListener('click', () => {
        document.getElementById('mr-cancel-confirm').style.display = 'none';
        document.getElementById('mr-actions-section').style.display = 'block';
    });
    document.getElementById('mr-back-link').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('mr-search').style.display = 'block';
        document.getElementById('mr-detail').style.display = 'none';
        document.getElementById('mr-code').value = '';
        currentReservation = null;
    });
    document.getElementById('mr-new-date').addEventListener('change', onModifyDateChange);
});
