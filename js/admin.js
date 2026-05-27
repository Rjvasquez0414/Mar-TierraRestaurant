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
                return;
            }
            this.user = data.user;
            this.showDashboard();
        });
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

        if (filtered.length === 0) {
            empty.style.display = 'block';
            return;
        }

        this.updateCounters(data);

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
                    <span class="adm-res-name">${escapeHtml(r.customer?.name) || 'Sin nombre'}</span>
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
        const today = new Date().toISOString().split('T')[0];
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const weekStr = weekFromNow.toISOString().split('T')[0];

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
                            ${l.details ? ` — ${JSON.stringify(l.details)}` : ''}
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
            html += `<a class="adm-btn adm-btn-sm adm-btn-warn" href="https://wa.me/${phone}?text=${reminderMsg}" target="_blank" rel="noopener">Recordar pago</a>`;
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
            btn.addEventListener('click', () => this.updateReservation(r.id, btn.dataset.action));
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
        if (action === 'confirm') updates.payment_status = 'verified';
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
        a.download = `clientes-martierra-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ================================================================
    // STATS
    // ================================================================

    async loadStats() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data: monthRes } = await sb.from('reservations')
            .select('status, deposit_amount, payment_status, salon_id')
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

            const salonCounts = {};
            monthRes.forEach(r => {
                salonCounts[r.salon_id] = (salonCounts[r.salon_id] || 0) + 1;
            });
            const occEl = document.getElementById('stat-salon-occupancy');
            if (occEl) {
                occEl.innerHTML = this.salons.map(s => {
                    const cnt = salonCounts[s.id] || 0;
                    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--adm-border)">
                        <span>${s.name}</span><span style="color:var(--adm-gold)">${cnt} reservas</span>
                    </div>`;
                }).join('');
            }
        }

        const { data: topCust } = await sb.from('customers')
            .select('name, phone, total_reservations, no_show_count')
            .order('total_reservations', { ascending: false })
            .limit(10);

        const topEl = document.getElementById('stat-top-customers');
        if (topEl && topCust) {
            topEl.innerHTML = topCust.map((c, i) => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--adm-border)">
                    <span>${i + 1}. ${escapeHtml(c.name)} <span style="color:var(--adm-text-muted);font-size:0.75rem">${escapeHtml(c.phone)}</span></span>
                    <span style="color:var(--adm-gold)">${c.total_reservations} reservas</span>
                </div>
            `).join('');
        }
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
            .gte('blocked_date', new Date().toISOString().split('T')[0])
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
}

// Init
const adminPanel = new AdminPanel();
