// =====================================================================
// Mar&Tierra — Admin Panel (Supabase)
// =====================================================================

const MT_WA = '573008263403';

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizePhone(phone) {
    if (!phone) return '';
    let p = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!p.startsWith('57')) p = '57' + p;
    return p.replace(/[^\d]/g, '');
}

function getLocalDateString(date) {
    if (!date) date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeCSV(str) {
    if (!str) return '""';
    return '"' + String(str).replace(/"/g, '""') + '"';
}

const VALID_TRANSITIONS = {
    pending: ['confirmed', 'cancelled', 'no_show'],
    confirmed: ['seated', 'cancelled', 'no_show'],
    seated: ['completed'],
    completed: [],
    cancelled: [],
    no_show: []
};

class AdminPanel {
    constructor() {
        this.user = null;
        this.salons = [];
        this.actionInProgress = false;
        this.currentView = 'reservations';
        this.realtimeChannel = null;
        this.calOffset = 0;
        this.calView = 'week';
        this.calReservations = [];
        this.init();
    }

    async init() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            this.user = session.user;
            this.showDashboard();
        } else {
            this.showLogin();
        }
        this.bindGlobalEvents();
    }

    // ================================================================
    // AUTH
    // ================================================================

    showLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.style.display = 'none';

            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) {
                errorEl.textContent = 'Email o contraseña incorrectos';
                errorEl.style.display = 'block';
                this.logAccess(email, false);
                return;
            }
            this.user = data.user;
            this.logAccess(email, true);
            this.showDashboard();
        });
    }

    async logAccess(email, success) {
        try {
            await sb.from('access_logs').insert({
                email: email,
                success: success,
                ip: null,
                user_agent: navigator.userAgent.slice(0, 200)
            });
        } catch (e) {}
    }

    async logout() {
        await sb.auth.signOut();
        this.user = null;
        if (this.realtimeChannel) {
            sb.removeChannel(this.realtimeChannel);
        }
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    async showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('admin-name').textContent = this.user.user_metadata?.name || this.user.email;

        await this.loadSalons();
        this.switchView('reservations');
        this.setupRealtime();
    }

    // ================================================================
    // GLOBAL EVENTS
    // ================================================================

    bindGlobalEvents() {
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        document.querySelectorAll('.adm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.switchView(tab.dataset.view);
            });
        });

        // View toggle (List / Calendar)
        document.querySelectorAll('.adm-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.adm-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.mode;
                document.getElementById('list-mode').style.display = mode === 'list' ? 'block' : 'none';
                document.getElementById('calendar-mode').style.display = mode === 'calendar' ? 'block' : 'none';
                if (mode === 'calendar') this.loadCalendar();
            });
        });

        // Calendar navigation
        document.getElementById('cal-prev')?.addEventListener('click', () => {
            this.calOffset += (this.calView === 'week' ? -7 : -1);
            this.loadCalendar();
        });
        document.getElementById('cal-next')?.addEventListener('click', () => {
            this.calOffset += (this.calView === 'week' ? 7 : 1);
            this.loadCalendar();
        });
        document.getElementById('cal-today')?.addEventListener('click', () => {
            this.calOffset = 0;
            this.loadCalendar();
        });
        document.querySelectorAll('.cal-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.calView = btn.dataset.calView;
                this.loadCalendar();
            });
        });

        document.getElementById('close-res-modal')?.addEventListener('click', () => {
            document.getElementById('reservation-modal').style.display = 'none';
        });
        document.getElementById('reservation-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'reservation-modal') {
                document.getElementById('reservation-modal').style.display = 'none';
            }
        });

        ['filter-date', 'filter-status', 'filter-salon'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.loadReservations());
        });

        document.getElementById('aforo-date')?.addEventListener('change', () => this.loadAforo());
        let searchTimer;
        document.getElementById('filter-search')?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.loadReservations(), 300);
        });

        let custSearchTimer;
        document.getElementById('customer-search')?.addEventListener('input', () => {
            clearTimeout(custSearchTimer);
            custSearchTimer = setTimeout(() => this.loadCustomers(), 300);
        });

        document.getElementById('export-csv')?.addEventListener('click', () => this.exportCustomersCSV());

        document.getElementById('block-slot-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.blockSlot();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('reservation-modal');
                if (modal && modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            }
        });
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.adm-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${view}`)?.classList.add('active');

        if (view === 'reservations') this.loadReservations();
        if (view === 'aforo') this.loadAforo();
        if (view === 'customers') this.loadCustomers();
        if (view === 'stats') this.loadStats();
        if (view === 'settings') this.loadSettings();
    }

    // ================================================================
    // DATA LOADING
    // ================================================================

    async loadSalons() {
        const { data } = await sb.from('salons').select('*').order('display_order');
        this.salons = data || [];

        const salonFilter = document.getElementById('filter-salon');
        const blockSalon = document.getElementById('block-salon');
        if (salonFilter) {
            salonFilter.innerHTML = '<option value="all">Todos</option>' +
                this.salons.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
        if (blockSalon) {
            blockSalon.innerHTML = '<option value="">Salón</option>' +
                this.salons.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    }

    getDateRange() {
        const filter = document.getElementById('filter-date')?.value || 'week';
        const today = new Date();
        const todayStr = getLocalDateString(today);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = getLocalDateString(tomorrow);

        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekStr = getLocalDateString(weekEnd);

        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        const monthStr = getLocalDateString(monthEnd);

        switch (filter) {
            case 'today': return { from: todayStr, to: todayStr };
            case 'tomorrow': return { from: tomorrowStr, to: tomorrowStr };
            case 'week': return { from: todayStr, to: weekStr };
            case 'month': return { from: todayStr, to: monthStr };
            default: return { from: null, to: null };
        }
    }

    async loadReservations() {
        const list = document.getElementById('reservations-list');
        const empty = document.getElementById('reservations-empty');
        const loading = document.getElementById('reservations-loading');

        loading.style.display = 'flex';
        list.innerHTML = '';
        empty.style.display = 'none';

        let query = sb.from('reservations')
            .select('*, customer:customers(*), salon:salons(name, slug)')
            .order('reservation_date', { ascending: true })
            .order('reservation_time', { ascending: true });

        const range = this.getDateRange();
        if (range.from) query = query.gte('reservation_date', range.from);
        if (range.to) query = query.lte('reservation_date', range.to);

        const status = document.getElementById('filter-status')?.value;
        if (status && status !== 'all') query = query.eq('status', status);

        const salon = document.getElementById('filter-salon')?.value;
        if (salon && salon !== 'all') query = query.eq('salon_id', salon);

        const { data, error } = await query;
        loading.style.display = 'none';

        if (error || !data) {
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Error al cargar reservas.';
            return;
        }

        const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
        let filtered = data;
        if (search) {
            filtered = data.filter(r =>
                r.reservation_code.toLowerCase().includes(search) ||
                r.customer?.name?.toLowerCase().includes(search) ||
                r.customer?.phone?.includes(search)
            );
        }

        // Ocultar reservas COMPLETADAS del listado por defecto — saturan la
        // vista. Siguen disponibles seleccionando "Completadas" en el filtro
        // de estado. Los contadores usan `data` completo, así que no se ven
        // afectados por este ocultamiento.
        const statusFilter = document.getElementById('filter-status')?.value;
        if (statusFilter !== 'completed') {
            filtered = filtered.filter(r => r.status !== 'completed');
        }

        // Contadores con el set completo (antes de ocultar completadas)
        this.updateCounters(data);

        if (filtered.length === 0) {
            empty.style.display = 'block';
            return;
        }

        list.innerHTML = filtered.map(r => this.renderReservationCard(r)).join('');

        list.querySelectorAll('.adm-res-card').forEach(card => {
            card.addEventListener('click', () => this.showReservationDetail(card.dataset.id, filtered));
        });
    }

    renderReservationCard(r) {
        const date = new Date(r.reservation_date + 'T12:00:00');
        const dateStr = date.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' });
        const time = r.reservation_time?.slice(0, 5);
        const statusLabels = {
            pending: 'Pendiente', confirmed: 'Confirmada', seated: 'En mesa',
            completed: 'Completada', cancelled: 'Cancelada', no_show: 'No-show'
        };
        const typeLabels = { free: 'Free', plata: 'Plata', oro: 'Oro', luxury: 'Luxury' };

        return `
            <div class="adm-res-card" data-id="${r.id}">
                <span class="adm-res-code">${r.reservation_code}</span>
                <div class="adm-res-info">
                    <span class="adm-res-name">${escapeHtml(r.customer?.name) || 'Sin nombre'}${r.has_valet ? ' <span style="background:rgba(212,175,55,0.15);color:#8B6914;font-size:0.52rem;letter-spacing:0.18em;text-transform:uppercase;padding:2px 6px;border-radius:2px;margin-left:6px;vertical-align:middle">Valet ' + (r.valet_vehicles || 1) + '</span>' : ''}</span>
                    <span class="adm-res-meta">${escapeHtml(r.customer?.phone) || ''} · ${r.party_size} pers. · ${typeLabels[r.reservation_type] || r.reservation_type} · $${(r.deposit_amount || 0).toLocaleString('es-CO')}</span>
                </div>
                <div class="adm-res-details">
                    <span class="adm-res-date">${dateStr} · ${time}</span>
                    <span class="adm-res-salon">${r.salon?.name || ''}</span>
                </div>
                <span class="adm-badge adm-badge-${r.status}">${statusLabels[r.status] || r.status}</span>
            </div>
        `;
    }

    updateCounters(reservations) {
        const today = getLocalDateString(new Date());
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const weekStr = getLocalDateString(weekFromNow);

        const todayRes = reservations.filter(r => r.reservation_date === today);
        document.getElementById('cnt-pending').textContent = todayRes.filter(r => r.status === 'pending').length;
        document.getElementById('cnt-confirmed').textContent = todayRes.filter(r => r.status === 'confirmed').length;
        document.getElementById('cnt-week').textContent = reservations.filter(r => r.reservation_date >= today && r.reservation_date <= weekStr).length;

        const weekRevenue = reservations
            .filter(r => r.reservation_date >= today && r.reservation_date <= weekStr && r.payment_status === 'verified')
            .reduce((sum, r) => sum + (r.deposit_amount || 0), 0);
        document.getElementById('cnt-revenue').textContent = '$' + weekRevenue.toLocaleString('es-CO');
    }

    // ================================================================
    // RESERVATION DETAIL
    // ================================================================

    async showReservationDetail(id, reservations) {
        const r = reservations?.find(x => x.id === id);
        if (!r) return;

        const { data: logs } = await sb.from('reservation_logs')
            .select('*').eq('reservation_id', id).order('created_at', { ascending: false });

        const modal = document.getElementById('reservation-modal');
        const detail = document.getElementById('reservation-detail');

        const statusLabels = {
            pending: 'Pendiente', confirmed: 'Confirmada', seated: 'En mesa',
            completed: 'Completada', cancelled: 'Cancelada', no_show: 'No-show'
        };
        const typeLabels = { free: 'Free', plata: 'Plata', oro: 'Oro', luxury: 'Luxury' };
        const date = new Date(r.reservation_date + 'T12:00:00').toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        detail.innerHTML = `
            <div class="adm-detail-header">
                <div class="adm-detail-code">${escapeHtml(r.reservation_code)}</div>
                <div class="adm-detail-title">${escapeHtml(r.customer?.name) || 'Sin nombre'}</div>
            </div>
            <div class="adm-detail-grid">
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Teléfono</span>
                    <span class="adm-detail-value">${escapeHtml(r.customer?.phone) || '—'}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Email</span>
                    <span class="adm-detail-value">${escapeHtml(r.customer?.email) || '—'}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Fecha y hora</span>
                    <span class="adm-detail-value">${date} · ${r.reservation_time?.slice(0, 5)}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Personas</span>
                    <span class="adm-detail-value">${r.party_size}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Salón</span>
                    <span class="adm-detail-value">${r.salon?.name || '—'}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Tipo</span>
                    <span class="adm-detail-value">${typeLabels[r.reservation_type] || r.reservation_type}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Anticipo</span>
                    <span class="adm-detail-value">$${(r.deposit_amount || 0).toLocaleString('es-CO')} ${r.is_consumable ? '(consumible)' : '(no consumible)'}</span>
                </div>
                <div class="adm-detail-item">
                    <span class="adm-detail-label">Estado</span>
                    <span class="adm-detail-value"><span class="adm-badge adm-badge-${r.status}">${statusLabels[r.status]}</span></span>
                </div>
                ${r.has_valet ? `<div class="adm-detail-item" style="grid-column:1/-1;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:4px;padding:10px 14px">
                    <span class="adm-detail-label">Valet Parking</span>
                    <span class="adm-detail-value"><strong style="color:#8B6914">SI</strong> — ${r.valet_vehicles || 1} ${r.valet_vehicles === 1 ? 'vehiculo' : 'vehiculos'}</span>
                </div>` : ''}
                ${r.special_requests ? `<div class="adm-detail-item" style="grid-column:1/-1">
                    <span class="adm-detail-label">Solicitudes especiales</span>
                    <span class="adm-detail-value">${escapeHtml(r.special_requests)}</span>
                </div>` : ''}
                ${r.admin_notes ? `<div class="adm-detail-item" style="grid-column:1/-1">
                    <span class="adm-detail-label">Notas admin</span>
                    <span class="adm-detail-value">${escapeHtml(r.admin_notes)}</span>
                </div>` : ''}
            </div>

            <div class="adm-detail-actions" id="detail-actions"></div>

            ${logs && logs.length ? `
                <div class="adm-detail-logs">
                    <h4>Historial</h4>
                    ${logs.map(l => `
                        <div class="adm-log-entry">
                            ${new Date(l.created_at).toLocaleString('es-CO')} — <strong>${l.action}</strong>
                            ${l.details ? ` — ${escapeHtml(JSON.stringify(l.details))}` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;

        const actions = document.getElementById('detail-actions');
        this.renderDetailActions(actions, r);

        modal.style.display = 'flex';
    }

    renderDetailActions(container, r) {
        const phone = normalizePhone(r.customer?.phone);
        const name = r.customer?.name || '';
        const code = r.reservation_code;
        const deposit = '$' + (r.deposit_amount || 0).toLocaleString('es-CO');
        const date = new Date(r.reservation_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' });
        const time = r.reservation_time?.slice(0, 5);

        let html = '';

        if (r.status === 'pending') {
            html += `<button class="adm-btn adm-btn-sm adm-btn-confirm" data-action="confirm">Confirmar pago</button>`;
            html += `<button class="adm-btn adm-btn-sm adm-btn-reject" data-action="cancel">Rechazar</button>`;
            const reminderMsg = encodeURIComponent(`Hola ${name}, te recordamos que tu reserva *${code}* requiere el anticipo de *${deposit}* para ser confirmada.\n\nBancolombia Cta. Corriente: 30200003995\nNIT: 901857854\nTitular: MYT RESTAURANT SAS\n\nEnvia tu comprobante a este chat. Gracias!`);
            html += `<button class="adm-btn adm-btn-sm adm-btn-warn" data-action="remind" data-phone="${phone}" data-wa-msg="${reminderMsg}" data-email="${r.customer?.email || ''}" data-customer-name="${escapeHtml(name)}" data-code="${code}" data-deposit="${deposit}" data-date="${date}" data-time="${time}" data-party="${r.party_size}" data-salon="${escapeHtml(r.salon?.name || '')}">Recordar pago</button>`;
        }

        if (r.status === 'confirmed') {
            html += `<button class="adm-btn adm-btn-sm adm-btn-info" data-action="seated">Marcar en mesa</button>`;
            html += `<button class="adm-btn adm-btn-sm adm-btn-reject" data-action="cancel">Cancelar</button>`;
            const confirmMsg = encodeURIComponent(`Hola ${name}, tu reserva *${code}* esta confirmada.\n\n- Fecha: ${date}\n- Hora: ${time}\n- Personas: ${r.party_size}\n- Salon: ${r.salon?.name || ''}\n\nTe esperamos en Mar&Tierra!`);
            html += `<a class="adm-btn adm-btn-sm adm-btn-confirm" href="https://wa.me/${phone}?text=${confirmMsg}" target="_blank" rel="noopener">WhatsApp confirmacion</a>`;
        }

        if (r.status === 'seated') {
            html += `<button class="adm-btn adm-btn-sm adm-btn-confirm" data-action="completed">Completar</button>`;
        }

        if (['pending', 'confirmed'].includes(r.status)) {
            html += `<button class="adm-btn adm-btn-sm adm-btn-reject" data-action="no_show">No-show</button>`;
            const noAvailMsg = encodeURIComponent(`Hola ${name}, lamentamos informarte que no tenemos disponibilidad para tu reserva *${code}* el ${date} a las ${time}.\n\nTe gustaria que busquemos otra fecha u horario? Estamos para ayudarte.`);
            html += `<a class="adm-btn adm-btn-sm adm-btn-ghost" href="https://wa.me/${phone}?text=${noAvailMsg}" target="_blank" rel="noopener">Sin disponibilidad</a>`;
        }

        container.innerHTML = html;

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'remind') {
                    this.sendPaymentReminder(btn);
                } else {
                    this.updateReservation(r.id, btn.dataset.action);
                }
            });
        });
    }

    async updateReservation(id, action) {
        if (this.actionInProgress) return;
        this.actionInProgress = true;

        const statusMap = {
            confirm: 'confirmed',
            cancel: 'cancelled',
            seated: 'seated',
            completed: 'completed',
            no_show: 'no_show'
        };

        const newStatus = statusMap[action];
        if (!newStatus) { this.actionInProgress = false; return; }

        // Get current status and validate transition
        const { data: current } = await sb.from('reservations').select('status').eq('id', id).single();
        if (current && VALID_TRANSITIONS[current.status] && !VALID_TRANSITIONS[current.status].includes(newStatus)) {
            alert('No se puede cambiar de "' + current.status + '" a "' + newStatus + '"');
            this.actionInProgress = false;
            return;
        }

        const updates = { status: newStatus };
        if (action === 'confirm') {
            updates.payment_status = 'verified';
            updates.expires_at = null; // pago verificado → ya no expira, retiene cupo en firme
        }
        if (action === 'cancel') {
            const reason = prompt('Razon de cancelacion:');
            if (!reason) { this.actionInProgress = false; return; }
            updates.cancellation_reason = reason;
            updates.payment_status = 'rejected';
        }

        try {
            const { error } = await sb.from('reservations').update(updates).eq('id', id);
            if (error) { alert('Error al actualizar'); return; }

            await sb.from('reservation_logs').insert({
                reservation_id: id,
                action: action,
                details: updates,
                performed_by: this.user.id
            });

            // no_show counter is handled by database trigger (sync_customer_noshow)

            document.getElementById('reservation-modal').style.display = 'none';
            this.loadReservations();
        } catch (err) {
            alert('Error de conexion. Intenta de nuevo.');
        } finally {
            this.actionInProgress = false;
        }
    }

    // ================================================================
    // PAYMENT REMINDER (WhatsApp + Email)
    // ================================================================

    async sendPaymentReminder(btn) {
        const phone = btn.dataset.phone;
        const waMsg = btn.dataset.waMsg;
        const email = btn.dataset.email;
        const name = btn.dataset.customerName;
        const code = btn.dataset.code;
        const deposit = btn.dataset.deposit;
        const date = btn.dataset.date;
        const time = btn.dataset.time;
        const party = btn.dataset.party;
        const salon = btn.dataset.salon;

        // Open WhatsApp
        window.open(`https://wa.me/${phone}?text=${waMsg}`, '_blank', 'noopener,noreferrer');

        // Send email reminder
        if (email) {
            btn.textContent = 'Enviando...';
            btn.disabled = true;
            try {
                await sb.functions.invoke('send-reservation-email', {
                    body: {
                        type: 'payment_reminder',
                        customerName: name,
                        customerEmail: email,
                        reservationCode: code,
                        depositAmount: deposit,
                        date: date,
                        time: time,
                        partySize: parseInt(party) || 0,
                        salonName: salon
                    }
                });
                btn.textContent = 'Enviado';
                setTimeout(() => { btn.textContent = 'Recordar pago'; btn.disabled = false; }, 3000);
            } catch (e) {
                btn.textContent = 'Email fallo';
                btn.disabled = false;
                console.warn('Reminder email failed:', e);
            }
        }
    }

    // ================================================================
    // AFORO — control de capacidad por fecha (turno ±2h)
    // ================================================================

    async loadAforo() {
        const dateInput = document.getElementById('aforo-date');
        if (dateInput && !dateInput.value) dateInput.value = getLocalDateString(new Date());
        const date = dateInput?.value || getLocalDateString(new Date());

        const loading = document.getElementById('aforo-loading');
        const empty = document.getElementById('aforo-empty');
        const grid = document.getElementById('aforo-grid');
        loading.style.display = 'flex';
        empty.style.display = 'none';
        grid.innerHTML = '';

        // Limpia pendientes vencidas (>24h sin pago) antes de calcular
        try { await sb.rpc('expire_stale_reservations'); } catch (e) { /* no bloqueante */ }

        const { data, error } = await sb
            .from('reservations')
            .select('*, customer:customers(name, phone), salon:salons(name, slug)')
            .eq('reservation_date', date)
            .in('status', ['pending', 'confirmed', 'seated'])
            .order('reservation_time', { ascending: true });

        loading.style.display = 'none';

        if (error) {
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Error al cargar el aforo.';
            return;
        }

        this.aforoReservations = data || [];

        // Renderiza una tarjeta por salón activo, ordenada por display_order
        const salons = (this.salons || []).filter(s => s.is_active);
        grid.innerHTML = salons.map(s => this.renderAforoSalon(s, this.aforoReservations)).join('');

        // Click en una fila → detalle; click en "Liberar" → liberar cupo
        grid.querySelectorAll('.adm-aforo-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.adm-aforo-release')) return;
                this.showReservationDetail(row.dataset.id, this.aforoReservations);
            });
        });
        grid.querySelectorAll('.adm-aforo-release').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.releaseReservation(btn.dataset.id);
            });
        });
    }

    // Pico de aforo simultáneo (mayor suma de personas en cualquier ventana ±2h)
    computeAforoPeak(reservations) {
        const toMin = t => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
        let peak = 0, peakConf = 0, peakPend = 0;
        reservations.forEach(center => {
            const c = toMin(center.reservation_time);
            let conf = 0, pend = 0;
            reservations.forEach(o => {
                if (Math.abs(toMin(o.reservation_time) - c) <= 120) {
                    if (o.status === 'confirmed' || o.status === 'seated') conf += o.party_size;
                    else if (o.status === 'pending') pend += o.party_size;
                }
            });
            if (conf + pend > peak) { peak = conf + pend; peakConf = conf; peakPend = pend; }
        });
        return { peak, peakConf, peakPend };
    }

    renderAforoSalon(salon, allReservations) {
        const res = allReservations.filter(r => r.salon_id === salon.id);
        const cap = salon.capacity || 0;
        const { peak, peakConf, peakPend } = this.computeAforoPeak(res);
        const pct = cap ? Math.min(Math.round((peak / cap) * 100), 100) : 0;
        const confPct = cap ? Math.min(Math.round((peakConf / cap) * 100), 100) : 0;
        const pendPct = cap ? Math.min(Math.round((peakPend / cap) * 100), 100) : 0;
        const level = peak >= cap ? 'full' : (peak >= cap * 0.8 ? 'high' : 'ok');

        const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmada', seated: 'En mesa' };

        const rows = res.length === 0
            ? '<p class="adm-aforo-norows">Sin reservas este día.</p>'
            : res.map(r => {
                const time = (r.reservation_time || '').slice(0, 5);
                const isPending = r.status === 'pending';
                const age = this.timeAgo(r.created_at);
                const expiry = isPending ? this.expiryLabel(r.expires_at) : '';
                return `
                <div class="adm-aforo-row ${isPending ? 'is-pending' : ''}" data-id="${r.id}">
                    <span class="adm-aforo-time">${time}</span>
                    <span class="adm-aforo-party">${r.party_size}p</span>
                    <span class="adm-aforo-cust">${escapeHtml(r.customer?.name) || 'Sin nombre'}</span>
                    <span class="adm-badge adm-badge-${r.status}">${statusLabels[r.status] || r.status}</span>
                    ${isPending ? `<span class="adm-aforo-age" title="Creada ${age}">${expiry}</span>` : '<span class="adm-aforo-age"></span>'}
                    ${isPending ? `<button class="adm-aforo-release" data-id="${r.id}" title="Liberar cupo (cancela esta reserva sin pago)">Liberar</button>` : '<span></span>'}
                </div>`;
            }).join('');

        return `
        <div class="adm-aforo-card adm-aforo-${level}">
            <div class="adm-aforo-card-head">
                <h3 class="adm-aforo-name">${escapeHtml(salon.name)}</h3>
                <span class="adm-aforo-peak">Pico: <strong>${peak}</strong> / ${cap}</span>
            </div>
            <div class="adm-aforo-bar" title="${peakConf} confirmadas + ${peakPend} pendientes de ${cap}">
                <span class="adm-aforo-fill confirmed" style="width:${confPct}%"></span>
                <span class="adm-aforo-fill pending" style="width:${pendPct}%"></span>
            </div>
            <div class="adm-aforo-legend">
                <span><i class="dot confirmed"></i>${peakConf} confirmadas</span>
                <span><i class="dot pending"></i>${peakPend} pendientes</span>
                <span><i class="dot free"></i>${Math.max(cap - peak, 0)} libres</span>
            </div>
            <div class="adm-aforo-rows">${rows}</div>
        </div>`;
    }

    timeAgo(iso) {
        if (!iso) return '';
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        if (diff < 3600) return 'hace ' + Math.max(1, Math.floor(diff / 60)) + ' min';
        if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
        return 'hace ' + Math.floor(diff / 86400) + ' d';
    }

    expiryLabel(iso) {
        if (!iso) return 'sin vencimiento';
        const mins = (new Date(iso).getTime() - Date.now()) / 60000;
        if (mins <= 0) return 'vencida';
        if (mins < 60) return 'vence en ' + Math.floor(mins) + ' min';
        return 'vence en ' + Math.floor(mins / 60) + ' h';
    }

    async releaseReservation(id) {
        if (this.actionInProgress) return;
        if (!confirm('¿Liberar el cupo de esta reserva? Se cancelará (sin pago) y el cupo quedará disponible.')) return;
        this.actionInProgress = true;
        try {
            const { error } = await sb.from('reservations').update({
                status: 'cancelled',
                payment_status: 'rejected',
                cancellation_reason: 'Liberado por admin (cupo, sin pago)'
            }).eq('id', id);
            if (error) { alert('Error al liberar el cupo.'); return; }
            await sb.from('reservation_logs').insert({
                reservation_id: id, action: 'cancelled',
                details: { reason: 'liberado-por-admin-aforo' },
                performed_by: this.user.id
            });
            this.loadAforo();
        } catch (e) {
            alert('Error de conexión. Intenta de nuevo.');
        } finally {
            this.actionInProgress = false;
        }
    }

    // ================================================================
    // CUSTOMERS
    // ================================================================

    async loadCustomers() {
        const list = document.getElementById('customers-list');
        const loading = document.getElementById('customers-loading');
        loading.style.display = 'flex';
        list.innerHTML = '';

        let query = sb.from('customers').select('*').order('total_reservations', { ascending: false });

        const search = (document.getElementById('customer-search')?.value || '').trim();
        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data } = await query.limit(100);
        loading.style.display = 'none';

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="adm-empty"><p>No se encontraron clientes.</p></div>';
            return;
        }

        list.innerHTML = data.map(c => `
            <div class="adm-cust-card">
                <div>
                    <span class="adm-cust-name">${escapeHtml(c.name)}</span>
                    <span class="adm-cust-phone">${escapeHtml(c.phone)} ${c.email ? '· ' + escapeHtml(c.email) : ''}</span>
                </div>
                <div class="adm-cust-stat">
                    <span class="adm-cust-stat-num">${c.total_reservations}</span>
                    <span class="adm-cust-stat-label">Reservas</span>
                </div>
                <div class="adm-cust-stat">
                    <span class="adm-cust-stat-num">${c.no_show_count}</span>
                    <span class="adm-cust-stat-label">No-shows</span>
                </div>
                <div class="adm-cust-stat">
                    <span class="adm-cust-stat-num">${c.last_visit ? new Date(c.last_visit).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }) : '—'}</span>
                    <span class="adm-cust-stat-label">Última visita</span>
                </div>
            </div>
        `).join('');
    }

    async exportCustomersCSV() {
        const { data } = await sb.from('customers').select('*').order('name');
        if (!data) return;
        const header = 'Nombre,Telefono,Email,Reservas,No-shows,Ultima visita\n';
        const rows = data.map(c =>
            `${escapeCSV(c.name)},${escapeCSV(c.phone)},${escapeCSV(c.email)},${c.total_reservations},${c.no_show_count},${escapeCSV(c.last_visit)}`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes-martierra-${getLocalDateString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ================================================================
    // STATS
    // ================================================================

    async loadStats() {
        const now = new Date();
        const monthStart = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
        const monthEnd = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

        // Fetch this month's data
        const { data: monthRes } = await sb.from('reservations')
            .select('status, deposit_amount, payment_status, salon_id, reservation_type')
            .gte('reservation_date', monthStart)
            .lte('reservation_date', monthEnd);

        if (monthRes) {
            const total = monthRes.length;
            const confirmed = monthRes.filter(r => ['confirmed', 'seated', 'completed'].includes(r.status)).length;
            const noShow = monthRes.filter(r => r.status === 'no_show').length;
            const revenue = monthRes.filter(r => r.payment_status === 'verified')
                .reduce((sum, r) => sum + (r.deposit_amount || 0), 0);

            document.getElementById('stat-month-total').textContent = total;
            document.getElementById('stat-confirm-rate').textContent = total ? Math.round(confirmed / total * 100) + '%' : '0%';
            document.getElementById('stat-noshow-rate').textContent = total ? Math.round(noShow / total * 100) + '%' : '0%';
            document.getElementById('stat-revenue').textContent = '$' + revenue.toLocaleString('es-CO');

            // Type distribution
            this.renderTypeDistribution(monthRes);

            // Salon occupancy
            this.renderSalonOccupancy(monthRes);
        }

        // Fetch last 30 days for daily chart
        const thirtyAgo = new Date(now);
        thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        const { data: dailyRes } = await sb.from('reservations')
            .select('reservation_date, status')
            .gte('reservation_date', getLocalDateString(thirtyAgo))
            .lte('reservation_date', getLocalDateString(now))
            .in('status', ['pending', 'confirmed', 'seated', 'completed']);

        if (dailyRes) this.renderDailyChart(dailyRes, thirtyAgo, now);

        // Fetch last 90 days for heatmap
        const ninetyAgo = new Date(now);
        ninetyAgo.setDate(ninetyAgo.getDate() - 90);
        const { data: heatRes } = await sb.from('reservations')
            .select('reservation_date, reservation_time')
            .gte('reservation_date', getLocalDateString(ninetyAgo))
            .in('status', ['pending', 'confirmed', 'seated', 'completed']);

        if (heatRes) this.renderHeatmap(heatRes);

        // Top customers
        const { data: topCust } = await sb.from('customers')
            .select('name, phone, total_reservations, no_show_count')
            .order('total_reservations', { ascending: false })
            .limit(10);

        const topEl = document.getElementById('stat-top-customers');
        if (topEl && topCust) {
            topEl.innerHTML = topCust.map((c, i) => `
                <div class="stat-hbar">
                    <span class="stat-hbar-label">${i + 1}. ${escapeHtml(c.name)}</span>
                    <div class="stat-hbar-track"><div class="stat-hbar-fill" style="width:${topCust[0]?.total_reservations ? (c.total_reservations / topCust[0].total_reservations * 100) : 0}%;background:#8B6914"></div></div>
                    <span class="stat-hbar-value">${c.total_reservations}</span>
                </div>
            `).join('');
        }
    }

    renderDailyChart(data, startDate, endDate) {
        const el = document.getElementById('stat-daily-chart');
        if (!el) return;

        const counts = {};
        data.forEach(r => { counts[r.reservation_date] = (counts[r.reservation_date] || 0) + 1; });

        const days = [];
        const d = new Date(startDate);
        while (d <= endDate) {
            days.push(getLocalDateString(d));
            d.setDate(d.getDate() + 1);
        }

        const max = Math.max(...days.map(d => counts[d] || 0), 1);
        const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

        el.innerHTML = days.map(day => {
            const cnt = counts[day] || 0;
            const pct = (cnt / max * 100);
            const dt = new Date(day + 'T12:00:00');
            const isToday = day === getLocalDateString();
            const color = isToday ? '#8B6914' : (cnt > 0 ? 'rgba(43,24,16,0.25)' : 'rgba(43,24,16,0.06)');
            return `<div class="stat-bar-wrap">
                <div class="stat-bar" style="height:${Math.max(pct, 3)}%;background:${color}" data-count="${cnt} reservas · ${dt.getDate()}/${dt.getMonth()+1}"></div>
                <span class="stat-bar-label">${dayLabels[dt.getDay()]}</span>
            </div>`;
        }).join('');
    }

    renderHeatmap(data) {
        const el = document.getElementById('stat-heatmap');
        if (!el) return;

        const counts = {};
        data.forEach(r => {
            const dt = new Date(r.reservation_date + 'T12:00:00');
            const day = dt.getDay();
            const hour = r.reservation_time?.slice(0, 5);
            if (!hour) return;
            const key = `${day}-${hour}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        const max = Math.max(...Object.values(counts), 1);
        const hours = [];
        for (let h = 11; h <= 22; h++) {
            hours.push(`${String(h).padStart(2, '0')}:00`);
            if (h < 22) hours.push(`${String(h).padStart(2, '0')}:30`);
        }
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

        el.style.gridTemplateColumns = `50px repeat(7, 1fr)`;

        let html = '<div class="stat-hm-header"></div>';
        dayNames.forEach(d => { html += `<div class="stat-hm-header">${d}</div>`; });

        hours.forEach(hour => {
            html += `<div class="stat-hm-label">${hour}</div>`;
            for (let day = 0; day < 7; day++) {
                const cnt = counts[`${day}-${hour}`] || 0;
                const intensity = cnt / max;
                const bg = cnt === 0
                    ? 'rgba(43,24,16,0.02)'
                    : `rgba(139, 105, 20, ${0.1 + intensity * 0.6})`;
                html += `<div class="stat-hm-cell" style="background:${bg}" data-tip="${hour} ${dayNames[day]}: ${cnt} reservas"></div>`;
            }
        });

        el.innerHTML = html;
    }

    renderTypeDistribution(data) {
        const el = document.getElementById('stat-type-dist');
        if (!el) return;

        const counts = { free: 0, plata: 0, oro: 0, luxury: 0 };
        data.forEach(r => { if (counts.hasOwnProperty(r.reservation_type)) counts[r.reservation_type]++; });
        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

        const colors = { free: 'rgba(43,24,16,0.3)', plata: '#8B8680', oro: '#8B6914', luxury: '#4A6E5A' };
        const labels = { free: 'Free', plata: 'Plata', oro: 'Oro', luxury: 'Luxury' };

        el.innerHTML = Object.entries(counts).map(([type, cnt]) => `
            <div class="stat-hbar">
                <span class="stat-hbar-label">${labels[type]}</span>
                <div class="stat-hbar-track"><div class="stat-hbar-fill" style="width:${cnt / total * 100}%;background:${colors[type]}"></div></div>
                <span class="stat-hbar-value">${cnt}</span>
            </div>
        `).join('');
    }

    renderSalonOccupancy(data) {
        const el = document.getElementById('stat-salon-occupancy');
        if (!el) return;

        const counts = {};
        data.forEach(r => { counts[r.salon_id] = (counts[r.salon_id] || 0) + 1; });
        const max = Math.max(...Object.values(counts), 1);

        el.innerHTML = this.salons.map(s => {
            const cnt = counts[s.id] || 0;
            return `<div class="stat-hbar">
                <span class="stat-hbar-label">${escapeHtml(s.name)}</span>
                <div class="stat-hbar-track"><div class="stat-hbar-fill" style="width:${cnt / max * 100}%;background:rgba(107,142,163,0.5)"></div></div>
                <span class="stat-hbar-value">${cnt}</span>
            </div>`;
        }).join('');
    }

    // ================================================================
    // SETTINGS
    // ================================================================

    async loadSettings() {
        const container = document.getElementById('settings-salons');
        if (container) {
            container.innerHTML = this.salons.map(s => `
                <div class="adm-salon-toggle">
                    <div>
                        <span class="adm-salon-toggle-name">${s.name}</span>
                        <span class="adm-salon-toggle-cap">Cap: ${s.capacity} · ${s.allows_shared ? 'Compartido' : 'Exclusivo'}</span>
                    </div>
                    <label class="adm-checkbox">
                        <input type="checkbox" ${s.is_active ? 'checked' : ''} data-salon-id="${s.id}">
                        <span>${s.is_active ? 'Activo' : 'Inactivo'}</span>
                    </label>
                </div>
            `).join('');

            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', async () => {
                    await sb.from('salons').update({ is_active: cb.checked }).eq('id', cb.dataset.salonId);
                    const label = cb.nextElementSibling;
                    if (label) label.textContent = cb.checked ? 'Activo' : 'Inactivo';
                });
            });
        }

        this.loadBlockedSlots();
        this.loadAccessLogs();
    }

    async blockSlot() {
        const salonId = document.getElementById('block-salon').value;
        const date = document.getElementById('block-date').value;
        const reason = document.getElementById('block-reason').value;
        const fullDay = document.getElementById('block-fullday').checked;

        if (!salonId || !date || !reason) return;

        const { error } = await sb.from('blocked_slots').insert({
            salon_id: salonId,
            blocked_date: date,
            reason: reason,
            is_full_day: fullDay,
            created_by: this.user.id
        });

        if (error) { alert('Error: ' + error.message); return; }

        document.getElementById('block-slot-form').reset();
        this.loadBlockedSlots();
    }

    async loadBlockedSlots() {
        const { data } = await sb.from('blocked_slots')
            .select('*, salon:salons(name)')
            .gte('blocked_date', getLocalDateString())
            .order('blocked_date');

        const container = document.getElementById('blocked-slots-list');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--adm-text-muted);font-size:0.85rem;margin-top:12px">No hay bloqueos activos.</p>';
            return;
        }

        container.innerHTML = data.map(b => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--adm-border)">
                <span>${b.salon?.name || 'Todos'} — ${new Date(b.blocked_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — ${b.reason}</span>
                <button class="adm-btn adm-btn-sm adm-btn-ghost" onclick="adminPanel.removeBlock('${b.id}')">Eliminar</button>
            </div>
        `).join('');
    }

    async removeBlock(id) {
        await sb.from('blocked_slots').delete().eq('id', id);
        this.loadBlockedSlots();
    }

    async loadAccessLogs() {
        const container = document.getElementById('access-logs-list');
        if (!container) return;

        const { data } = await sb.from('access_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--adm-text-muted);font-size:0.85rem">No hay registros de acceso.</p>';
            return;
        }

        container.innerHTML = data.map(log => {
            const date = new Date(log.created_at).toLocaleString('es-CO');
            const status = log.success
                ? '<span style="color:var(--adm-green)">Exitoso</span>'
                : '<span style="color:var(--adm-red)">Fallido</span>';
            const device = log.user_agent
                ? (log.user_agent.includes('Mobile') ? 'Movil' : log.user_agent.includes('Tablet') ? 'Tablet' : 'Desktop')
                : '—';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--adm-border);font-size:0.82rem">
                <span>${escapeHtml(log.email)}</span>
                <span style="color:var(--adm-text-muted)">${device}</span>
                <span style="color:var(--adm-text-muted);font-variant-numeric:tabular-nums">${date}</span>
                ${status}
            </div>`;
        }).join('');
    }

    // ================================================================
    // REALTIME
    // ================================================================

    setupRealtime() {
        if (this.realtimeChannel) {
            sb.removeChannel(this.realtimeChannel);
        }

        this.realtimeChannel = sb
            .channel('reservations-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'reservations'
            }, () => {
                if (this.currentView === 'reservations') {
                    this.loadReservations();
                    if (document.getElementById('calendar-mode')?.style.display !== 'none') {
                        this.loadCalendar();
                    }
                }
            })
            .subscribe((status) => {
                const indicator = document.getElementById('realtime-status');
                if (status === 'SUBSCRIBED') {
                    if (indicator) { indicator.textContent = 'En vivo'; indicator.className = 'adm-realtime-on'; }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    if (indicator) { indicator.textContent = 'Desconectado'; indicator.className = 'adm-realtime-off'; }
                    setTimeout(() => this.setupRealtime(), 5000);
                }
            });
    }

    // ================================================================
    // CALENDAR VIEW
    // ================================================================

    getCalendarRange() {
        const today = new Date();
        if (this.calView === 'day') {
            const d = new Date(today);
            d.setDate(d.getDate() + this.calOffset);
            const str = getLocalDateString(d);
            return { from: str, to: str, dates: [d] };
        }
        // Week view: start from Monday
        const start = new Date(today);
        start.setDate(start.getDate() + this.calOffset - ((start.getDay() + 6) % 7));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return {
            from: getLocalDateString(dates[0]),
            to: getLocalDateString(dates[6]),
            dates
        };
    }

    async loadCalendar() {
        const grid = document.getElementById('cal-grid');
        const title = document.getElementById('cal-title');
        const loading = document.getElementById('cal-loading');
        if (!grid) return;

        loading.style.display = 'flex';
        const range = this.getCalendarRange();

        // Update title
        if (this.calView === 'day') {
            title.textContent = range.dates[0].toLocaleDateString('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
        } else {
            const d0 = range.dates[0];
            const d6 = range.dates[6];
            const monthSame = d0.getMonth() === d6.getMonth();
            title.textContent = d0.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) +
                ' - ' + d6.toLocaleDateString('es-CO', { day: 'numeric', month: monthSame ? undefined : 'short', year: 'numeric' });
        }

        // Fetch reservations + blocked slots
        const { data: reservations } = await sb.from('reservations')
            .select('*, customer:customers(name, phone), salon:salons(name, slug)')
            .gte('reservation_date', range.from)
            .lte('reservation_date', range.to)
            .in('status', ['pending', 'confirmed', 'seated', 'completed']);

        const { data: blocked } = await sb.from('blocked_slots')
            .select('*, salon:salons(name)')
            .gte('blocked_date', range.from)
            .lte('blocked_date', range.to);

        this.calReservations = reservations || [];
        loading.style.display = 'none';

        this.renderCalendar(range, reservations || [], blocked || []);
    }

    renderCalendar(range, reservations, blocked) {
        const grid = document.getElementById('cal-grid');
        const todayStr = getLocalDateString();

        // Time slots: 11:00 to 23:30 (30-min increments)
        const slots = [];
        for (let h = 11; h <= 23; h++) {
            slots.push(`${String(h).padStart(2,'0')}:00`);
            slots.push(`${String(h).padStart(2,'0')}:30`);
        }

        const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

        if (this.calView === 'week') {
            grid.className = 'cal-grid cal-week';

            let html = '<div class="cal-col-header"></div>';
            range.dates.forEach(d => {
                const ds = getLocalDateString(d);
                const isToday = ds === todayStr;
                html += `<div class="cal-col-header ${isToday ? 'today' : ''}">
                    ${dayNames[d.getDay()]}
                    <span class="cal-col-header-day">${d.getDate()}</span>
                </div>`;
            });

            slots.forEach(slot => {
                html += `<div class="cal-time-label">${slot}</div>`;
                range.dates.forEach(d => {
                    const ds = getLocalDateString(d);
                    const isToday = ds === todayStr;
                    const isBlocked = blocked.some(b =>
                        b.blocked_date === ds && (b.is_full_day || (slot >= b.start_time && slot < b.end_time))
                    );
                    html += `<div class="cal-cell ${isToday ? 'today-col' : ''} ${isBlocked ? 'blocked' : ''}" data-date="${ds}" data-time="${slot}">`;

                    const cellRes = reservations.filter(r =>
                        r.reservation_date === ds && r.reservation_time?.slice(0, 5) === slot
                    );
                    cellRes.forEach(r => {
                        html += `<div class="cal-event status-${r.status}" data-id="${r.id}" title="${escapeHtml(r.customer?.name)} - ${escapeHtml(r.salon?.name)} - ${r.party_size} pers.">
                            <span class="cal-event-name">${escapeHtml(r.customer?.name)}</span>
                            <span class="cal-event-meta">${escapeHtml(r.salon?.name)} · ${r.party_size}p</span>
                        </div>`;
                    });
                    html += '</div>';
                });
            });

            grid.innerHTML = html;

        } else {
            // Day view: columns = salons
            const activeSalons = this.salons.filter(s => s.is_active);
            grid.className = 'cal-grid cal-day';
            grid.style.setProperty('--salon-count', activeSalons.length);

            let html = '<div class="cal-col-header"></div>';
            activeSalons.forEach(s => {
                html += `<div class="cal-col-header">${escapeHtml(s.name)}<br><span style="font-size:0.5rem;opacity:0.6">Cap: ${s.capacity}</span></div>`;
            });

            const dateStr = getLocalDateString(range.dates[0]);
            slots.forEach(slot => {
                html += `<div class="cal-time-label">${slot}</div>`;
                activeSalons.forEach(s => {
                    const isBlocked = blocked.some(b =>
                        b.blocked_date === dateStr &&
                        (b.salon_id === s.id || !b.salon_id) &&
                        (b.is_full_day || (slot >= b.start_time && slot < b.end_time))
                    );
                    html += `<div class="cal-cell ${isBlocked ? 'blocked' : ''}" data-date="${dateStr}" data-time="${slot}" data-salon="${s.id}">`;

                    const cellRes = reservations.filter(r =>
                        r.salon_id === s.id && r.reservation_time?.slice(0, 5) === slot
                    );
                    cellRes.forEach(r => {
                        html += `<div class="cal-event status-${r.status}" data-id="${r.id}" title="${escapeHtml(r.customer?.name)} - ${r.party_size} pers.">
                            <span class="cal-event-name">${escapeHtml(r.customer?.name)}</span>
                            <span class="cal-event-meta">${r.party_size}p · ${r.reservation_type}</span>
                        </div>`;
                    });
                    html += '</div>';
                });
            });

            grid.innerHTML = html;
        }

        // Click on calendar events opens detail modal
        grid.querySelectorAll('.cal-event').forEach(ev => {
            ev.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showReservationDetail(ev.dataset.id, this.calReservations);
            });
        });
    }
}

// Init
const adminPanel = new AdminPanel();
