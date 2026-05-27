// =====================================================================
// Mar&Tierra — Sistema de Reservas v2 (Supabase)
// Wizard de 3 pasos: Cuándo → Experiencia → Confirmar
// =====================================================================

class ReservationWizard {
    constructor() {
        this.step = 1;
        this.submitting = false;
        this.lastSalonLoad = 0;
        this.data = {
            date: null,
            time: null,
            partySize: null,
            salonId: null,
            salonName: null,
            type: null,
            typeName: null,
            deposit: 0,
            consumable: false,
            name: '',
            phone: '',
            email: '',
            requests: ''
        };
        this.salons = [];
        this.el = document.getElementById('reservation-wizard');
        if (!this.el) return;

        if (typeof sb === 'undefined' || !sb?.rpc) {
            this.el.innerHTML = '<div class="rw-error" style="display:block;text-align:center;padding:40px">Error al conectar con el servidor. Recarga la pagina.</div>';
            return;
        }

        this.render();
        this.bindEvents();
    }

    // Restaurant operating hours by day (0=Sun, 1=Mon, ...)
    getHours(dayOfWeek) {
        const hours = {
            0: { open: '11:30', close: '21:00' },
            1: { open: '11:30', close: '22:00' },
            2: { open: '11:30', close: '23:00' },
            3: { open: '11:30', close: '23:00' },
            4: { open: '11:30', close: '23:00' },
            5: { open: '11:30', close: '00:00' },
            6: { open: '11:30', close: '00:00' }
        };
        return hours[dayOfWeek];
    }

    generateTimeSlots(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const day = new Date(y, m - 1, d).getDay();
        const h = this.getHours(day);
        if (!h) return [];

        const slots = [];
        const [openH, openM] = h.open.split(':').map(Number);
        const [closeH, closeM] = h.close.split(':').map(Number);

        let endMinutes = closeH * 60 + closeM;
        if (endMinutes === 0) endMinutes = 24 * 60;
        endMinutes -= 60;

        for (let m = openH * 60 + openM; m <= endMinutes; m += 30) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
        return slots;
    }

    formatTime(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    formatPrice(amount) {
        return '$' + amount.toLocaleString('es-CO');
    }

    toLocalDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    getMinDate() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return this.toLocalDate(d);
    }

    getMaxDate() {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return this.toLocalDate(d);
    }

    // ================================================================
    // RENDER
    // ================================================================

    render() {
        this.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.el.innerHTML = `
            <div class="rw-container">
                ${this.renderProgress()}
                <div class="rw-body">
                    ${this.step === 1 ? this.renderStep1() : ''}
                    ${this.step === 2 ? this.renderStep2() : ''}
                    ${this.step === 3 ? this.renderStep3() : ''}
                    ${this.step === 4 ? this.renderSuccess() : ''}
                </div>
            </div>
        `;
        this.bindEvents();
    }

    renderProgress() {
        if (this.step === 4) return '';
        const steps = [
            { n: 1, label: 'Fecha y lugar' },
            { n: 2, label: 'Experiencia' },
            { n: 3, label: 'Confirmar' }
        ];
        return `
            <div class="rw-progress">
                ${steps.map(s => `
                    <div class="rw-step ${this.step === s.n ? 'active' : ''} ${this.step > s.n ? 'done' : ''}">
                        <span class="rw-step-num">${this.step > s.n ? '✓' : s.n}</span>
                        <span class="rw-step-label">${s.label}</span>
                    </div>
                `).join('<div class="rw-step-line"></div>')}
            </div>
        `;
    }

    renderStep1() {
        const today = this.getMinDate();
        const max = this.getMaxDate();
        return `
            <div class="rw-step-content" data-step="1">
                <div class="rw-header">
                    <h3 class="rw-title">¿Cuándo nos visitas?</h3>
                    <p class="rw-subtitle">Selecciona fecha, hora y número de personas</p>
                </div>

                <div class="rw-fields">
                    <div class="rw-field">
                        <label class="rw-label">Fecha</label>
                        <input type="date" class="rw-input" id="rw-date"
                               min="${today}" max="${max}"
                               value="${this.data.date || ''}"
                               required>
                    </div>

                    <div class="rw-field">
                        <label class="rw-label">Hora</label>
                        <select class="rw-input" id="rw-time" ${!this.data.date ? 'disabled' : ''}>
                            <option value="">Selecciona fecha primero</option>
                            ${this.data.date ? this.generateTimeSlots(this.data.date).map(t =>
                                `<option value="${t}" ${this.data.time === t ? 'selected' : ''}>${this.formatTime(t)}</option>`
                            ).join('') : ''}
                        </select>
                    </div>

                    <div class="rw-field">
                        <label class="rw-label">Personas</label>
                        <select class="rw-input" id="rw-party">
                            <option value="">¿Cuántos serán?</option>
                            ${Array.from({ length: 14 }, (_, i) => i + 1).map(n =>
                                `<option value="${n}" ${this.data.partySize === n ? 'selected' : ''}>${n} ${n === 1 ? 'persona' : 'personas'}</option>`
                            ).join('')}
                            <option value="15+">15 o más personas</option>
                        </select>
                    </div>
                </div>

                <div id="rw-large-group" class="rw-large-group" style="display:none">
                    <div class="rw-large-group-content">
                        <p class="rw-large-group-title">Experiencia Personalizada</p>
                        <p class="rw-large-group-text">Para grupos de 15+ personas ofrecemos experiencias a la medida: menú personalizado, decoración exclusiva, saxofonista, DJ, fotógrafo y más.</p>
                        <a href="https://wa.me/573008263403?text=${encodeURIComponent('Hola Mar&Tierra! Quisiera organizar una experiencia personalizada.\n\n- Fecha tentativa: \n- Numero de personas: \n- Tipo de evento: \n\nQuedo atento(a).')}"
                           class="rw-wa-btn" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 .02 5.37 0 12c0 2.12.55 4.18 1.6 6.01L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52z"/></svg>
                            Cotizar por WhatsApp
                        </a>
                    </div>
                </div>

                <div id="rw-salons" class="rw-salons" style="display:none">
                    <label class="rw-label">Elige tu espacio</label>
                    <div class="rw-salons-grid" id="rw-salons-grid"></div>
                    <div id="rw-salons-loading" class="rw-loading" style="display:none">
                        <div class="rw-spinner"></div>
                        <span>Verificando disponibilidad...</span>
                    </div>
                    <div id="rw-salons-empty" class="rw-empty" style="display:none">
                        <p>No hay disponibilidad para la fecha y hora seleccionadas. Prueba con otro horario.</p>
                    </div>
                </div>

                <div class="rw-actions">
                    <button type="button" class="rw-btn rw-btn-next" id="rw-next-1" disabled>
                        Continuar
                    </button>
                </div>
            </div>
        `;
    }

    renderStep2() {
        const types = [
            {
                key: 'free',
                name: 'Reserva Free',
                tagline: 'Tu mesa, sin adornos',
                price: 100000,
                consumable: true,
                includes: ['Mesa garantizada', 'Anticipo se descuenta de la cuenta'],
                icon: `<svg viewBox="0 0 32 32"><path d="M16 4v24M8 12h16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`
            },
            {
                key: 'plata',
                name: 'Plan Plata',
                tagline: 'Globos y pastel',
                price: 80000,
                consumable: false,
                includes: ['3 globos premium con helio', 'Porción de pastel artesanal', 'Tarjeta personalizada'],
                icon: `<svg viewBox="0 0 32 32"><circle cx="12" cy="10" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="20" cy="10" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 15v10m8-10v10" stroke="currentColor" stroke-width="1.5"/></svg>`
            },
            {
                key: 'oro',
                name: 'Plan Oro',
                tagline: 'Vino, globos y pastel',
                price: 120000,
                consumable: false,
                includes: ['Botella de vino 375ml', '3 globos dorados con helio', 'Pastel gourmet', 'Copas especiales'],
                icon: `<svg viewBox="0 0 32 32"><path d="M12 4l-2 12h12l-2-12z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 16v8m-4 0h8" stroke="currentColor" stroke-width="1.5"/></svg>`
            },
            {
                key: 'luxury',
                name: 'Plan Luxury',
                tagline: 'Rosas, pétalos y velas',
                price: 100000,
                consumable: false,
                includes: ['12 rosas naturales', 'Pétalos sobre la mesa', 'Velas aromáticas', 'Playlist personalizada'],
                icon: `<svg viewBox="0 0 32 32"><path d="M16 6c-3 0-6 3-6 7 0 5 6 13 6 13s6-8 6-13c0-4-3-7-6-7z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="16" cy="14" r="2" fill="currentColor"/></svg>`
            }
        ];

        return `
            <div class="rw-step-content" data-step="2">
                <div class="rw-header">
                    <h3 class="rw-title">Elige tu experiencia</h3>
                    <p class="rw-subtitle">${this.data.partySize} ${this.data.partySize === 1 ? 'persona' : 'personas'} · ${this.data.salonName} · ${this.formatTime(this.data.time)}</p>
                </div>

                <div class="rw-types-grid">
                    ${types.map(t => `
                        <button type="button" class="rw-type-card ${this.data.type === t.key ? 'selected' : ''}"
                                data-type="${t.key}" data-price="${t.price}" data-consumable="${t.consumable}" data-name="${t.name}">
                            <div class="rw-type-icon">${t.icon}</div>
                            <h4 class="rw-type-name">${t.name}</h4>
                            <p class="rw-type-tagline">${t.tagline}</p>
                            <div class="rw-type-price">
                                <span class="rw-price-amount">${this.formatPrice(t.price)}</span>
                                ${t.consumable ? '<span class="rw-price-badge">Consumible</span>' : '<span class="rw-price-badge rw-badge-deco">No consumible</span>'}
                            </div>
                            <ul class="rw-type-includes">
                                ${t.includes.map(i => `<li>${i}</li>`).join('')}
                            </ul>
                        </button>
                    `).join('')}
                </div>

                <div class="rw-personalized">
                    <div class="rw-personalized-content">
                        <div class="rw-personalized-text">
                            <h4>Experiencia Personalizada</h4>
                            <p>Saxofonista, DJ, fotógrafo, violinista y más — cotiza tu evento a la medida.</p>
                        </div>
                        <a href="https://wa.me/573008263403?text=${encodeURIComponent('Hola Mar&Tierra! Me interesa una experiencia personalizada.\n\n- Fecha: ' + (this.data.date || '') + '\n- Hora: ' + (this.data.time ? this.formatTime(this.data.time) : '') + '\n- Personas: ' + (this.data.partySize || '') + '\n- Salon: ' + (this.data.salonName || '') + '\n\nQue opciones tienen?')}"
                           class="rw-wa-btn rw-wa-sm" target="_blank" rel="noopener">
                            Cotizar
                        </a>
                    </div>
                </div>

                <div class="rw-actions">
                    <button type="button" class="rw-btn rw-btn-back" id="rw-back-2">Atrás</button>
                    <button type="button" class="rw-btn rw-btn-next" id="rw-next-2" ${!this.data.type ? 'disabled' : ''}>
                        Continuar
                    </button>
                </div>
            </div>
        `;
    }

    renderStep3() {
        return `
            <div class="rw-step-content" data-step="3">
                <div class="rw-header">
                    <h3 class="rw-title">Confirma tu reserva</h3>
                    <p class="rw-subtitle">Revisa los datos y completa tu información</p>
                </div>

                <div class="rw-summary">
                    <div class="rw-summary-row">
                        <span class="rw-summary-label">Fecha</span>
                        <span class="rw-summary-value">${new Date(this.data.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div class="rw-summary-row">
                        <span class="rw-summary-label">Hora</span>
                        <span class="rw-summary-value">${this.formatTime(this.data.time)}</span>
                    </div>
                    <div class="rw-summary-row">
                        <span class="rw-summary-label">Personas</span>
                        <span class="rw-summary-value">${this.data.partySize}</span>
                    </div>
                    <div class="rw-summary-row">
                        <span class="rw-summary-label">Espacio</span>
                        <span class="rw-summary-value">${this.data.salonName}</span>
                    </div>
                    <div class="rw-summary-row">
                        <span class="rw-summary-label">Experiencia</span>
                        <span class="rw-summary-value">${this.data.typeName}</span>
                    </div>
                    <div class="rw-summary-row rw-summary-total">
                        <span class="rw-summary-label">Anticipo requerido</span>
                        <span class="rw-summary-value">${this.formatPrice(this.data.deposit)} ${this.data.consumable ? '(consumible)' : '(no consumible)'}</span>
                    </div>
                </div>

                <div class="rw-fields rw-fields-contact">
                    <div class="rw-field">
                        <label class="rw-label">Nombre completo</label>
                        <input type="text" class="rw-input" id="rw-name" placeholder="Tu nombre"
                               value="${this.data.name}" required autocomplete="name">
                    </div>
                    <div class="rw-field">
                        <label class="rw-label">Teléfono</label>
                        <input type="tel" class="rw-input" id="rw-phone" placeholder="300 123 4567"
                               value="${this.data.phone}" required autocomplete="tel" inputmode="tel">
                    </div>
                    <div class="rw-field">
                        <label class="rw-label">Email</label>
                        <input type="email" class="rw-input" id="rw-email" placeholder="correo@ejemplo.com"
                               value="${this.data.email}" required autocomplete="email" inputmode="email">
                    </div>
                    <div class="rw-field rw-field-full">
                        <label class="rw-label">Solicitudes especiales <span class="rw-optional">(opcional)</span></label>
                        <textarea class="rw-input rw-textarea" id="rw-requests"
                                  placeholder="Alergias, celebraciones, preferencias...">${this.data.requests}</textarea>
                    </div>
                </div>

                <div class="rw-payment-info">
                    <h4 class="rw-payment-title">Información de pago</h4>
                    <div class="rw-payment-details">
                        <p><strong>Bancolombia</strong> — Cuenta Corriente</p>
                        <p>No. Cuenta: <strong>30200003995</strong></p>
                        <p>NIT: 901857854</p>
                        <p>Titular: MYT RESTAURANT SAS</p>
                    </div>
                    <p class="rw-payment-note">Envía el comprobante de pago por WhatsApp al <strong>300 826 3403</strong> para confirmar tu reserva.</p>
                </div>

                <div class="rw-policies">
                    <label class="rw-checkbox">
                        <input type="checkbox" id="rw-accept-policies">
                        <span>He leído y acepto las <a href="#" id="rw-policies-link">políticas de cancelación</a></span>
                    </label>
                </div>

                <div id="rw-error" class="rw-error" style="display:none"></div>

                <div class="rw-actions">
                    <button type="button" class="rw-btn rw-btn-back" id="rw-back-3">Atrás</button>
                    <button type="button" class="rw-btn rw-btn-submit" id="rw-submit" disabled>
                        <span class="rw-btn-text">Reservar</span>
                        <span class="rw-btn-loading" style="display:none">
                            <span class="rw-spinner-sm"></span> Procesando...
                        </span>
                    </button>
                </div>
            </div>
        `;
    }

    renderSuccess() {
        const dateStr = new Date(this.data.date + 'T12:00:00').toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const waMsg = encodeURIComponent(
            `Hola Mar&Tierra! Acabo de realizar mi reserva.\n\n` +
            `- Codigo: ${this.data.reservationCode}\n` +
            `- Fecha: ${dateStr}\n` +
            `- Hora: ${this.formatTime(this.data.time)}\n` +
            `- Personas: ${this.data.partySize}\n` +
            `- Anticipo: ${this.formatPrice(this.data.deposit)}\n\n` +
            `Adjunto comprobante de pago.`
        );

        return `
            <div class="rw-step-content rw-success">
                <div class="rw-success-icon">
                    <svg viewBox="0 0 48 48" width="64" height="64">
                        <circle cx="24" cy="24" r="22" stroke="var(--dorado-premium)" stroke-width="2" fill="none"/>
                        <path d="M14 24l7 7 13-13" stroke="var(--dorado-premium)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h3 class="rw-success-title">¡Reserva registrada!</h3>
                <p class="rw-success-code">${this.escapeHtml(this.data.reservationCode)}</p>

                <div class="rw-success-summary">
                    <p>${this.escapeHtml(dateStr)} · ${this.escapeHtml(this.formatTime(this.data.time))}</p>
                    <p>${this.data.partySize} personas · ${this.escapeHtml(this.data.salonName)}</p>
                    <p>${this.escapeHtml(this.data.typeName)} · Anticipo: ${this.formatPrice(this.data.deposit)}</p>
                </div>

                <div class="rw-success-steps">
                    <h4>Siguiente paso</h4>
                    <ol>
                        <li>Realiza la transferencia de <strong>${this.formatPrice(this.data.deposit)}</strong> a la cuenta Bancolombia indicada</li>
                        <li>Envía el comprobante por WhatsApp</li>
                        <li>Tu reserva será confirmada tras verificar el pago</li>
                    </ol>
                </div>

                <div class="rw-success-actions">
                    <a href="https://wa.me/573008263403?text=${waMsg}"
                       class="rw-btn rw-btn-wa" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 .02 5.37 0 12c0 2.12.55 4.18 1.6 6.01L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52z"/></svg>
                        Enviar comprobante
                    </a>
                    <a href="mi-reserva.html?code=${this.escapeHtml(this.data.reservationCode)}" class="rw-btn rw-btn-back" style="text-decoration:none;text-align:center">
                        Consultar mi reserva
                    </a>
                    <button type="button" class="rw-btn rw-btn-back" id="rw-new-reservation">
                        Nueva reserva
                    </button>
                </div>
                ${this.emailFailed ? '<p class="rw-email-warn">No pudimos enviar el email de confirmacion. Revisa tu bandeja de spam o contactanos por WhatsApp.</p>' : ''}
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ================================================================
    // EVENTS
    // ================================================================

    bindEvents() {
        // Step 1
        const dateInput = document.getElementById('rw-date');
        const timeSelect = document.getElementById('rw-time');
        const partySelect = document.getElementById('rw-party');
        const nextBtn1 = document.getElementById('rw-next-1');

        if (dateInput) {
            dateInput.addEventListener('change', () => {
                const selected = dateInput.value;
                const min = this.getMinDate();
                const max = this.getMaxDate();
                if (selected < min) {
                    dateInput.value = '';
                    this.data.date = null;
                    alert('La fecha debe ser a partir de manana (' + min + ')');
                    return;
                }
                if (selected > max) {
                    dateInput.value = '';
                    this.data.date = null;
                    alert('La fecha no puede ser mayor a 3 meses');
                    return;
                }
                this.data.date = selected;
                this.data.time = null;
                this.data.salonId = null;
                this.updateTimeSlots();
                this.checkStep1();
            });
        }

        if (timeSelect) {
            timeSelect.addEventListener('change', () => {
                this.data.time = timeSelect.value;
                this.data.salonId = null;
                this.loadSalons();
                this.checkStep1();
            });
        }

        if (partySelect) {
            partySelect.addEventListener('change', () => {
                const val = partySelect.value;
                if (val === '15+') {
                    this.data.partySize = null;
                    document.getElementById('rw-large-group').style.display = 'block';
                    document.getElementById('rw-salons').style.display = 'none';
                    this.checkStep1();
                    return;
                }
                document.getElementById('rw-large-group').style.display = 'none';
                this.data.partySize = parseInt(val) || null;
                this.data.salonId = null;
                if (this.data.date && this.data.time && this.data.partySize) {
                    this.loadSalons();
                }
                this.checkStep1();
            });
        }

        if (nextBtn1) {
            nextBtn1.addEventListener('click', () => { this.step = 2; this.render(); });
        }

        // Step 2
        this.el.querySelectorAll('.rw-type-card').forEach(card => {
            card.addEventListener('click', () => {
                this.data.type = card.dataset.type;
                this.data.typeName = card.dataset.name;
                this.data.deposit = parseInt(card.dataset.price);
                this.data.consumable = card.dataset.consumable === 'true';
                this.el.querySelectorAll('.rw-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const next2 = document.getElementById('rw-next-2');
                if (next2) next2.disabled = false;
            });
        });

        const backBtn2 = document.getElementById('rw-back-2');
        const nextBtn2 = document.getElementById('rw-next-2');
        if (backBtn2) backBtn2.addEventListener('click', () => { this.step = 1; this.render(); });
        if (nextBtn2) nextBtn2.addEventListener('click', () => { this.step = 3; this.render(); });

        // Step 3
        const backBtn3 = document.getElementById('rw-back-3');
        const submitBtn = document.getElementById('rw-submit');
        const policiesCheck = document.getElementById('rw-accept-policies');
        const policiesLink = document.getElementById('rw-policies-link');

        if (backBtn3) backBtn3.addEventListener('click', () => { this.step = 2; this.render(); });

        if (policiesCheck) {
            policiesCheck.addEventListener('change', () => this.checkStep3());
        }

        ['rw-name', 'rw-phone', 'rw-email'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.checkStep3());
                el.addEventListener('paste', () => setTimeout(() => this.checkStep3(), 10));
            }
        });

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submit());
        }

        if (policiesLink) {
            policiesLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPoliciesModal();
            });
        }

        // Step 4 (success)
        const newResBtn = document.getElementById('rw-new-reservation');
        if (newResBtn) {
            newResBtn.addEventListener('click', () => {
                this.step = 1;
                this.data = { date: null, time: null, partySize: null, salonId: null, salonName: null, type: null, typeName: null, deposit: 0, consumable: false, name: '', phone: '', email: '', requests: '' };
                this.render();
            });
        }

        // Salon card clicks
        this.el.querySelectorAll('.rw-salon-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('unavailable')) return;
                this.data.salonId = card.dataset.id;
                this.data.salonName = card.dataset.name;
                this.el.querySelectorAll('.rw-salon-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.checkStep1();
            });
        });
    }

    // ================================================================
    // STEP VALIDATORS
    // ================================================================

    checkStep1() {
        const btn = document.getElementById('rw-next-1');
        if (btn) {
            btn.disabled = !(this.data.date && this.data.time && this.data.partySize && this.data.salonId);
        }
    }

    checkStep3() {
        const name = document.getElementById('rw-name')?.value.trim();
        const phone = document.getElementById('rw-phone')?.value.trim();
        const email = document.getElementById('rw-email')?.value.trim();
        const policies = document.getElementById('rw-accept-policies')?.checked;

        this.data.name = name || '';
        this.data.phone = phone || '';
        this.data.email = email || '';
        this.data.requests = document.getElementById('rw-requests')?.value.trim() || '';

        const btn = document.getElementById('rw-submit');
        if (btn) {
            const digits = (phone || '').replace(/\D/g, '');
            const phoneValid = digits.length === 10 || (digits.startsWith('57') && digits.length === 12);
            const emailValid = email && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
            btn.disabled = !(name && phoneValid && emailValid && policies);

            const phoneEl = document.getElementById('rw-phone');
            const emailEl = document.getElementById('rw-email');
            if (phoneEl) phoneEl.classList.toggle('rw-input-error', phone && !phoneValid);
            if (emailEl) emailEl.classList.toggle('rw-input-error', email && !emailValid);
        }
    }

    // ================================================================
    // DATA LOADING
    // ================================================================

    updateTimeSlots() {
        const timeSelect = document.getElementById('rw-time');
        if (!timeSelect) return;

        if (!this.data.date) {
            timeSelect.innerHTML = '<option value="">Selecciona fecha primero</option>';
            timeSelect.disabled = true;
            return;
        }

        const slots = this.generateTimeSlots(this.data.date);
        timeSelect.innerHTML = '<option value="">Selecciona hora</option>' +
            slots.map(t => `<option value="${t}">${this.formatTime(t)}</option>`).join('');
        timeSelect.disabled = false;
    }

    async loadSalons() {
        const grid = document.getElementById('rw-salons-grid');
        const loading = document.getElementById('rw-salons-loading');
        const empty = document.getElementById('rw-salons-empty');
        const container = document.getElementById('rw-salons');

        if (!grid || !this.data.date || !this.data.time || !this.data.partySize) return;

        container.style.display = 'block';
        loading.style.display = 'flex';
        empty.style.display = 'none';
        grid.innerHTML = '';

        try {
            const { data, error } = await sb.rpc('get_available_salons', {
                p_date: this.data.date,
                p_time: this.data.time,
                p_party_size: this.data.partySize
            });

            loading.style.display = 'none';

            if (error) throw error;
            if (!data || data.length === 0) {
                empty.style.display = 'block';
                return;
            }

            this.salons = data;
            const available = data.filter(s => s.is_available);

            if (available.length === 0) {
                empty.style.display = 'block';
                return;
            }

            grid.innerHTML = data.map(s => `
                <button type="button"
                    class="rw-salon-card ${s.is_available ? '' : 'unavailable'} ${this.data.salonId === s.id ? 'selected' : ''}"
                    data-id="${s.id}" data-name="${s.name}"
                    ${!s.is_available ? 'disabled' : ''}>
                    <div class="rw-salon-img" style="background-image: url('${s.image_url || ''}')"></div>
                    <div class="rw-salon-info">
                        <h4 class="rw-salon-name">${s.name}</h4>
                        <p class="rw-salon-desc">${s.description || ''}</p>
                        ${s.is_available
                            ? '<span class="rw-salon-status available">Disponible</span>'
                            : '<span class="rw-salon-status full">Sin disponibilidad</span>'
                        }
                    </div>
                </button>
            `).join('');

            // Re-bind salon card clicks
            this.el.querySelectorAll('.rw-salon-card').forEach(card => {
                card.addEventListener('click', () => {
                    if (card.classList.contains('unavailable')) return;
                    this.data.salonId = card.dataset.id;
                    this.data.salonName = card.dataset.name;
                    this.el.querySelectorAll('.rw-salon-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.checkStep1();
                });
            });
        } catch (err) {
            loading.style.display = 'none';
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Error al verificar disponibilidad. Intenta de nuevo.';
            console.error('Salon availability error:', err);
        }
    }

    // ================================================================
    // SUBMIT
    // ================================================================

    async submit() {
        if (this.submitting) return;
        this.submitting = true;

        const btn = document.getElementById('rw-submit');
        const errorEl = document.getElementById('rw-error');
        if (!btn) { this.submitting = false; return; }

        btn.disabled = true;
        btn.querySelector('.rw-btn-text').style.display = 'none';
        btn.querySelector('.rw-btn-loading').style.display = 'inline-flex';
        errorEl.style.display = 'none';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const { data, error } = await sb.rpc('create_reservation', {
                p_name: this.data.name,
                p_phone: this.data.phone.replace(/\D/g, ''),
                p_email: this.data.email,
                p_salon_id: this.data.salonId,
                p_type: this.data.type,
                p_date: this.data.date,
                p_time: this.data.time,
                p_party_size: this.data.partySize,
                p_requests: this.escapeHtml(this.data.requests) || null
            });

            if (error) throw error;

            if (data && data.success) {
                this.data.reservationCode = data.reservation_code;
                this.data.deposit = data.deposit_amount;
                this.sendConfirmationEmail(data);
                this.step = 4;
                this.render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error(data?.error || 'Error desconocido al crear la reserva');
            }
        } catch (err) {
            const msg = err.name === 'AbortError'
                ? 'La conexion tardo demasiado. Verifica tu internet e intenta de nuevo.'
                : (err.message || 'Error al procesar la reserva. Intenta de nuevo.');
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.querySelector('.rw-btn-text').style.display = 'inline';
            btn.querySelector('.rw-btn-loading').style.display = 'none';
            console.error('Reservation error:', err);
        } finally {
            clearTimeout(timeout);
            this.submitting = false;
        }
    }

    // ================================================================
    // POLICIES MODAL
    // ================================================================

    showPoliciesModal() {
        const existing = document.getElementById('rw-policies-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'rw-policies-modal';
        modal.className = 'rw-modal-overlay';
        modal.innerHTML = `
            <div class="rw-modal">
                <button type="button" class="rw-modal-close" aria-label="Cerrar">&times;</button>
                <h3>Políticas de Reserva</h3>
                <div class="rw-modal-body">
                    <h4>Anticipo</h4>
                    <ul>
                        <li><strong>Reserva Free ($100.000):</strong> Totalmente consumible — se descuenta de tu cuenta final.</li>
                        <li><strong>Plan Plata ($80.000), Oro ($120.000), Luxury ($100.000):</strong> NO consumible, NO reembolsable. El costo cubre la decoración y montaje.</li>
                    </ul>
                    <h4>Cancelación y reagendamiento</h4>
                    <ul>
                        <li>Cancelar con al menos <strong>48 horas</strong> de anticipación.</li>
                        <li>Puedes reprogramar dentro de los próximos <strong>10 días</strong>.</li>
                        <li>Pasados 10 días sin reprogramar, se pierde el anticipo.</li>
                        <li>En caso de no presentarse (no-show), el anticipo NO es reembolsable.</li>
                    </ul>
                    <h4>Métodos de pago</h4>
                    <ul>
                        <li>Transferencia a <strong>Bancolombia</strong> (Cta. Corriente 30200003995, NIT 901857854, MYT RESTAURANT SAS).</li>
                        <li>Efectivo en caja del restaurante.</li>
                        <li>Comprobante obligatorio para validar la reserva.</li>
                    </ul>
                    <h4>Importante</h4>
                    <ul>
                        <li>La mesa se mantiene reservada hasta <strong>30 minutos</strong> después de la hora indicada.</li>
                        <li>No nos responsabilizamos por pagos fuera de los canales autorizados.</li>
                    </ul>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('active'));

        modal.querySelector('.rw-modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 400);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 400);
            }
        });
    }

    // ================================================================
    // EMAIL NOTIFICATION (via Supabase Edge Function + Resend)
    // ================================================================

    async sendConfirmationEmail(resData) {
        const typeNames = { free: 'Reserva Free', plata: 'Plan Plata', oro: 'Plan Oro', luxury: 'Plan Luxury' };
        const dateStr = new Date(this.data.date + 'T12:00:00').toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        try {
            const { error: emailError } = await sb.functions.invoke('send-reservation-email', {
                body: {
                    customerName: this.data.name,
                    customerEmail: this.data.email,
                    reservationCode: resData.reservation_code,
                    date: dateStr,
                    time: this.formatTime(this.data.time),
                    partySize: this.data.partySize,
                    salonName: resData.salon_name,
                    typeName: typeNames[this.data.type] || this.data.type,
                    depositAmount: resData.deposit_amount,
                    isConsumable: resData.is_consumable
                }
            });
            if (emailError) {
                this.emailFailed = true;
                console.warn('Email notification failed:', emailError);
            }
        } catch (e) {
            this.emailFailed = true;
            console.warn('Email notification failed (non-blocking):', e);
        }
    }
}

// Init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.reservationWizard = new ReservationWizard();
});
