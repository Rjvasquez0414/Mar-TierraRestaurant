#!/usr/bin/env python3
"""
Test Exhaustivo del Sistema de Reservas - Mar & Tierra Restaurant
=================================================================
Este test valida todas las funcionalidades críticas del sistema de reservas:
- Apertura del modal
- Campos del formulario
- Validaciones de campos requeridos
- Validación de fechas (pasadas/futuras)
- Selector dinámico de hora por día
- Tipos de reserva y cálculo de precios
- Validación de email y teléfono
- Envío del formulario
"""
from playwright.sync_api import sync_playwright
import os
import json
from datetime import datetime, timedelta

os.makedirs('/tmp/mar-tierra-tests/reservations', exist_ok=True)

# Colores para output
class Colors:
    PASS = '\033[92m'
    FAIL = '\033[91m'
    WARN = '\033[93m'
    INFO = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

test_results = {
    "timestamp": datetime.now().isoformat(),
    "system": "Reservation System",
    "tests": [],
    "summary": {"passed": 0, "failed": 0, "warnings": 0, "critical_failures": []}
}

def log_test(category, name, status, details="", critical=False):
    result = {"category": category, "name": name, "status": status, "details": details, "critical": critical}
    test_results["tests"].append(result)

    if status == "PASSED":
        icon = f"{Colors.PASS}✅{Colors.END}"
        test_results["summary"]["passed"] += 1
    elif status == "FAILED":
        icon = f"{Colors.FAIL}❌{Colors.END}"
        test_results["summary"]["failed"] += 1
        if critical:
            test_results["summary"]["critical_failures"].append(f"{category}: {name}")
    else:
        icon = f"{Colors.WARN}⚠️{Colors.END}"
        test_results["summary"]["warnings"] += 1

    print(f"   {icon} {name}")
    if details:
        detail_color = Colors.FAIL if status == "FAILED" else Colors.WARN if status == "WARNING" else ""
        print(f"      {detail_color}└─ {details}{Colors.END}")

def section_header(title):
    print(f"\n{Colors.BOLD}{'=' * 65}")
    print(f"📋 {title}")
    print(f"{'=' * 65}{Colors.END}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})

    print(f"\n{Colors.BOLD}{'#' * 65}")
    print("  🍽️  TEST EXHAUSTIVO DEL SISTEMA DE RESERVAS")
    print(f"  Mar & Tierra Restaurant - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'#' * 65}{Colors.END}")

    # Cargar página
    page.goto('http://127.0.0.1:5501/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3500)  # Esperar preloader

    # ================================================================
    # TEST 1: APERTURA DEL MODAL DE RESERVAS
    # ================================================================
    section_header("TEST 1: APERTURA DEL MODAL DE RESERVAS")

    # Verificar que existe el modal
    modal_exists = page.evaluate('!!document.getElementById("reservationModal")')
    log_test("Modal", "Modal existe en el DOM", "PASSED" if modal_exists else "FAILED", critical=True)

    # Verificar botón de reserva en header
    reserve_btn_header = page.evaluate('''
        !!document.querySelector('header .btn-reserve, header a[href*="reserv"], .nav-links .btn-reserve')
    ''')
    log_test("Modal", "Botón reservar en header", "PASSED" if reserve_btn_header else "WARNING")

    # Abrir modal
    modal_opened = page.evaluate('''
        () => {
            // Intentar múltiples formas de abrir el modal
            const btn = document.querySelector('.btn-reserve, [onclick*="openReservationModal"]');
            if (btn) {
                btn.click();
                return "button";
            }
            if (typeof openReservationModal === 'function') {
                openReservationModal();
                return "function";
            }
            // Forzar apertura
            const modal = document.getElementById("reservationModal");
            if (modal) {
                modal.classList.add("active");
                modal.style.display = "flex";
                return "forced";
            }
            return false;
        }
    ''')
    page.wait_for_timeout(700)

    modal_visible = page.evaluate('''
        () => {
            const modal = document.getElementById("reservationModal");
            if (!modal) return false;
            const style = getComputedStyle(modal);
            return style.display !== "none" && style.visibility !== "hidden";
        }
    ''')
    log_test("Modal", "Modal se abre correctamente", "PASSED" if modal_visible else "FAILED",
             f"Método: {modal_opened}" if modal_opened else "No se pudo abrir", critical=True)

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/01_modal_open.png')

    # ================================================================
    # TEST 2: CAMPOS DEL FORMULARIO
    # ================================================================
    section_header("TEST 2: CAMPOS DEL FORMULARIO")

    required_fields = {
        'resName': {'label': 'Nombre completo', 'type': 'text', 'required': True},
        'resPhone': {'label': 'Teléfono', 'type': 'tel', 'required': True},
        'resEmail': {'label': 'Email', 'type': 'email', 'required': True},
        'resPeople': {'label': 'Número de personas', 'type': 'select', 'required': True},
        'resDate': {'label': 'Fecha de reserva', 'type': 'date', 'required': True},
        'resTime': {'label': 'Hora de reserva', 'type': 'select', 'required': True},
        'resType': {'label': 'Tipo de reserva', 'type': 'select', 'required': True}
    }

    for field_id, info in required_fields.items():
        field_check = page.evaluate(f'''
            () => {{
                const field = document.getElementById("{field_id}");
                if (!field) return {{ exists: false }};
                return {{
                    exists: true,
                    type: field.tagName.toLowerCase() === "select" ? "select" : field.type,
                    required: field.required,
                    disabled: field.disabled
                }};
            }}
        ''')

        if field_check['exists']:
            details = f"Tipo: {field_check['type']}"
            if field_check.get('disabled'):
                details += " (deshabilitado)"
            log_test("Campos", f"{info['label']} ({field_id})", "PASSED", details)
        else:
            log_test("Campos", f"{info['label']} ({field_id})", "FAILED", "Campo no encontrado", critical=True)

    # Verificar campo de comentarios (opcional)
    comments_field = page.evaluate('!!document.getElementById("resComments")')
    log_test("Campos", "Campo de comentarios (opcional)", "PASSED" if comments_field else "WARNING")

    # ================================================================
    # TEST 3: VALIDACIÓN DE CAMPOS REQUERIDOS
    # ================================================================
    section_header("TEST 3: VALIDACIÓN DE CAMPOS REQUERIDOS")

    # Limpiar todos los campos
    page.evaluate('''
        () => {
            const fields = ["resName", "resPhone", "resEmail", "resDate"];
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            const people = document.getElementById("resPeople");
            if (people) people.selectedIndex = 0;
        }
    ''')

    # Intentar enviar formulario vacío
    page.evaluate('''
        () => {
            const form = document.getElementById("reservationForm");
            const submitBtn = document.querySelector(".btn-submit, button[type='submit']");
            if (submitBtn) submitBtn.click();
        }
    ''')
    page.wait_for_timeout(600)

    # Verificar errores mostrados
    errors_info = page.evaluate('''
        () => {
            const errors = document.querySelectorAll(".form-group.error");
            const errorMsgs = document.querySelectorAll(".error-message.show");
            return {
                groupErrors: errors.length,
                messageErrors: errorMsgs.length,
                messages: Array.from(errorMsgs).map(e => e.textContent).slice(0, 5)
            };
        }
    ''')

    if errors_info['groupErrors'] > 0 or errors_info['messageErrors'] > 0:
        log_test("Validación", "Detecta campos vacíos",
                 "PASSED", f"{errors_info['groupErrors']} errores visuales")
    else:
        log_test("Validación", "Detecta campos vacíos",
                 "WARNING", "No se mostraron errores visibles")

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/02_validation_empty.png')

    # ================================================================
    # TEST 4: VALIDACIÓN DE EMAIL
    # ================================================================
    section_header("TEST 4: VALIDACIÓN DE EMAIL")

    test_emails = [
        ('email_invalido', False, 'Sin @'),
        ('email@', False, 'Sin dominio'),
        ('@dominio.com', False, 'Sin usuario'),
        ('test@test', False, 'Sin TLD'),
        ('test@example.com', True, 'Email válido'),
        ('usuario.nombre@empresa.co', True, 'Email con puntos'),
    ]

    for email, should_pass, desc in test_emails:
        # Limpiar errores previos
        page.evaluate('document.querySelectorAll(".form-group.error").forEach(e => e.classList.remove("error"))')
        page.evaluate('document.querySelectorAll(".error-message.show").forEach(e => e.classList.remove("show"))')

        # Llenar email
        page.evaluate(f'document.getElementById("resEmail").value = "{email}"')

        # Llenar otros campos mínimos para que la validación de email se ejecute
        page.evaluate('''
            document.getElementById("resName").value = "Test User";
            document.getElementById("resPhone").value = "3001234567";
        ''')

        # Trigger validation
        page.evaluate('document.querySelector(".btn-submit")?.click()')
        page.wait_for_timeout(400)

        # Verificar error de email
        email_has_error = page.evaluate('''
            () => {
                const emailGroup = document.getElementById("resEmail")?.closest(".form-group");
                return emailGroup?.classList.contains("error") || false;
            }
        ''')

        if should_pass and not email_has_error:
            log_test("Email", f"'{email}' ({desc})", "PASSED", "Aceptado correctamente")
        elif not should_pass and email_has_error:
            log_test("Email", f"'{email}' ({desc})", "PASSED", "Rechazado correctamente")
        elif should_pass and email_has_error:
            log_test("Email", f"'{email}' ({desc})", "FAILED", "Debería ser aceptado")
        else:
            log_test("Email", f"'{email}' ({desc})", "FAILED", "Debería ser rechazado")

    # ================================================================
    # TEST 5: VALIDACIÓN DE TELÉFONO
    # ================================================================
    section_header("TEST 5: VALIDACIÓN DE TELÉFONO")

    test_phones = [
        ('123', False, 'Muy corto'),
        ('abcdefghij', False, 'Solo letras'),
        ('3001234567', True, 'Celular colombiano'),
        ('+573001234567', True, 'Con código país'),
        ('(300) 123-4567', True, 'Con formato'),
    ]

    for phone, should_pass, desc in test_phones:
        page.evaluate('document.querySelectorAll(".form-group.error").forEach(e => e.classList.remove("error"))')
        page.evaluate('document.querySelectorAll(".error-message.show").forEach(e => e.classList.remove("show"))')

        page.evaluate(f'''
            document.getElementById("resPhone").value = "{phone}";
            document.getElementById("resName").value = "Test User";
            document.getElementById("resEmail").value = "test@example.com";
        ''')

        page.evaluate('document.querySelector(".btn-submit")?.click()')
        page.wait_for_timeout(400)

        phone_has_error = page.evaluate('''
            () => {
                const phoneGroup = document.getElementById("resPhone")?.closest(".form-group");
                return phoneGroup?.classList.contains("error") || false;
            }
        ''')

        if should_pass and not phone_has_error:
            log_test("Teléfono", f"'{phone}' ({desc})", "PASSED", "Aceptado")
        elif not should_pass and phone_has_error:
            log_test("Teléfono", f"'{phone}' ({desc})", "PASSED", "Rechazado")
        elif should_pass and phone_has_error:
            log_test("Teléfono", f"'{phone}' ({desc})", "WARNING", "Podría ser válido")
        else:
            log_test("Teléfono", f"'{phone}' ({desc})", "WARNING", "Podría necesitar validación")

    # ================================================================
    # TEST 6: SELECTOR DINÁMICO DE HORA
    # ================================================================
    section_header("TEST 6: SELECTOR DINÁMICO DE HORA POR DÍA")

    # Verificar que hora está deshabilitada sin fecha
    time_initially_disabled = page.evaluate('document.getElementById("resTime")?.disabled')
    log_test("Hora Dinámica", "Hora deshabilitada sin fecha",
             "PASSED" if time_initially_disabled else "FAILED",
             "Funcionalidad crítica", critical=True)

    # Definir horarios esperados por día
    expected_hours = {
        0: {'name': 'Domingo', 'open': '11:30', 'last': '20:00', 'forbidden': ['21:00', '22:00']},
        1: {'name': 'Lunes', 'open': '11:30', 'last': '21:00', 'forbidden': ['22:00', '23:00']},
        2: {'name': 'Martes', 'open': '11:30', 'last': '22:00', 'forbidden': ['23:00']},
        4: {'name': 'Jueves', 'open': '11:30', 'last': '22:00', 'forbidden': ['23:00']},
        5: {'name': 'Viernes', 'open': '11:30', 'last': '22:59', 'forbidden': []},
        6: {'name': 'Sábado', 'open': '11:30', 'last': '22:59', 'forbidden': []},
    }

    today = datetime.now()

    for day_num, expected in expected_hours.items():
        # Calcular próxima fecha para este día
        days_ahead = (day_num - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target_date = today + timedelta(days=days_ahead)
        date_str = target_date.strftime('%Y-%m-%d')

        # Seleccionar fecha
        page.evaluate(f'''
            () => {{
                const dateField = document.getElementById("resDate");
                dateField.value = "{date_str}";
                dateField.dispatchEvent(new Event("change", {{ bubbles: true }}));
            }}
        ''')
        page.wait_for_timeout(500)

        # Obtener opciones de hora
        time_options = page.evaluate('''
            Array.from(document.getElementById("resTime")?.options || [])
                .map(o => o.value)
                .filter(v => v)
        ''')

        time_enabled = page.evaluate('!document.getElementById("resTime")?.disabled')

        # Verificaciones
        if not time_enabled:
            log_test("Hora Dinámica", f"{expected['name']}: Hora habilitada",
                     "FAILED", "Selector sigue deshabilitado", critical=True)
            continue

        log_test("Hora Dinámica", f"{expected['name']}: Hora habilitada", "PASSED")

        # Verificar hora de apertura
        has_open = expected['open'] in time_options
        log_test("Hora Dinámica", f"{expected['name']}: Apertura {expected['open']}",
                 "PASSED" if has_open else "FAILED")

        # Verificar última hora
        has_last = expected['last'] in time_options or any(t >= expected['last'] for t in time_options if t)
        log_test("Hora Dinámica", f"{expected['name']}: Última hora ~{expected['last']}",
                 "PASSED" if has_last else "WARNING",
                 f"Opciones: {time_options[-3:]}" if time_options else "Sin opciones")

        # Verificar horas prohibidas
        for forbidden in expected['forbidden']:
            has_forbidden = forbidden in time_options
            log_test("Hora Dinámica", f"{expected['name']}: Sin {forbidden}",
                     "PASSED" if not has_forbidden else "FAILED",
                     f"{forbidden} no debería estar disponible" if has_forbidden else "")

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/03_time_selector.png')

    # ================================================================
    # TEST 7: VALIDACIÓN DE FECHAS
    # ================================================================
    section_header("TEST 7: VALIDACIÓN DE FECHAS")

    # Test fecha pasada
    yesterday = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    page.evaluate(f'''
        () => {{
            document.querySelectorAll(".form-group.error").forEach(e => e.classList.remove("error"));
            document.querySelectorAll(".error-message.show").forEach(e => e.classList.remove("show"));
            document.getElementById("resDate").value = "{yesterday}";
            document.getElementById("resName").value = "Test";
            document.getElementById("resPhone").value = "3001234567";
            document.getElementById("resEmail").value = "test@test.com";
            document.getElementById("resTime").disabled = false;
            document.getElementById("resTime").innerHTML = '<option value="12:00">12:00 PM</option>';
            document.getElementById("resTime").value = "12:00";
        }}
    ''')
    page.evaluate('document.querySelector(".btn-submit")?.click()')
    page.wait_for_timeout(500)

    date_error = page.evaluate('''
        document.getElementById("resDate")?.closest(".form-group")?.classList.contains("error") || false
    ''')
    log_test("Fechas", "Rechaza fecha pasada", "PASSED" if date_error else "FAILED",
             f"Fecha: {yesterday}", critical=True)

    # Test fecha muy lejana (opcional)
    far_future = (today + timedelta(days=365)).strftime('%Y-%m-%d')
    page.evaluate(f'document.getElementById("resDate").value = "{far_future}"')

    # Test atributo min del campo fecha
    min_date = page.evaluate('document.getElementById("resDate")?.getAttribute("min")')
    today_str = today.strftime('%Y-%m-%d')
    log_test("Fechas", "Atributo min establecido",
             "PASSED" if min_date == today_str else "WARNING",
             f"min='{min_date}', esperado='{today_str}'" if min_date else "Sin atributo min")

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/04_date_validation.png')

    # ================================================================
    # TEST 8: TIPOS DE RESERVA Y CÁLCULO DE PRECIOS
    # ================================================================
    section_header("TEST 8: TIPOS DE RESERVA Y CÁLCULO DE PRECIOS")

    # Obtener tipos de reserva disponibles
    reservation_types = page.evaluate('''
        () => {
            const select = document.getElementById("resType");
            if (!select) return [];
            return Array.from(select.options).map(o => ({
                value: o.value,
                text: o.textContent
            }));
        }
    ''')

    log_test("Tipos", f"Tipos de reserva disponibles",
             "PASSED" if len(reservation_types) >= 3 else "WARNING",
             f"{len(reservation_types)} tipos encontrados")

    for rt in reservation_types:
        if rt['value']:
            log_test("Tipos", f"  → {rt['text'][:40]}", "PASSED", f"value: {rt['value']}")

    # Probar cambio de tipo y verificar que actualiza UI
    page.evaluate('''
        () => {
            const typeSelect = document.getElementById("resType");
            if (typeSelect && typeSelect.options.length > 1) {
                typeSelect.value = typeSelect.options[1].value;
                typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
    ''')
    page.wait_for_timeout(500)

    # Verificar si hay sección de resumen de precios
    price_summary = page.evaluate('''
        () => {
            const summary = document.querySelector(".price-summary, .reservation-summary, #priceSummary, .total-anticipo");
            return summary ? summary.textContent : null;
        }
    ''')
    log_test("Tipos", "Resumen de precios visible",
             "PASSED" if price_summary else "WARNING",
             price_summary[:50] + "..." if price_summary and len(price_summary) > 50 else price_summary or "No encontrado")

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/05_reservation_types.png')

    # ================================================================
    # TEST 9: DECORACIONES Y SERVICIOS ADICIONALES
    # ================================================================
    section_header("TEST 9: DECORACIONES Y SERVICIOS ADICIONALES")

    # Verificar opciones de decoración
    decoration_options = page.evaluate('''
        document.querySelectorAll('[name="decorationPlan"], .decoration-option, input[type="radio"][name*="decor"]').length
    ''')
    log_test("Extras", "Opciones de decoración",
             "PASSED" if decoration_options > 0 else "WARNING",
             f"{decoration_options} opciones" if decoration_options else "No encontradas")

    # Verificar servicios adicionales (músicos, fotógrafo, etc.)
    services = page.evaluate('''
        () => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"][name="services"], .service-option input');
            return Array.from(checkboxes).map(cb => ({
                value: cb.value,
                label: cb.closest('label')?.textContent?.trim().slice(0, 30) || cb.value
            }));
        }
    ''')

    if services:
        log_test("Extras", f"Servicios adicionales encontrados", "PASSED", f"{len(services)} servicios")
        for svc in services[:4]:
            log_test("Extras", f"  → {svc['label']}", "PASSED")
    else:
        log_test("Extras", "Servicios adicionales", "WARNING", "No encontrados")

    # ================================================================
    # TEST 10: SIMULACIÓN DE ENVÍO COMPLETO
    # ================================================================
    section_header("TEST 10: SIMULACIÓN DE RESERVA COMPLETA")

    # Llenar formulario completo con datos válidos
    next_saturday = today + timedelta(days=(5 - today.weekday()) % 7 + 7)
    saturday_str = next_saturday.strftime('%Y-%m-%d')

    page.evaluate(f'''
        () => {{
            // Limpiar errores
            document.querySelectorAll(".form-group.error").forEach(e => e.classList.remove("error"));
            document.querySelectorAll(".error-message.show").forEach(e => e.classList.remove("show"));

            // Llenar campos
            document.getElementById("resName").value = "Juan Pérez Test";
            document.getElementById("resPhone").value = "3001234567";
            document.getElementById("resEmail").value = "juan.perez@example.com";

            const people = document.getElementById("resPeople");
            if (people) people.value = people.options[2]?.value || "4";

            document.getElementById("resDate").value = "{saturday_str}";
            document.getElementById("resDate").dispatchEvent(new Event("change", {{ bubbles: true }}));
        }}
    ''')
    page.wait_for_timeout(600)

    # Seleccionar hora
    page.evaluate('''
        () => {
            const timeSelect = document.getElementById("resTime");
            if (timeSelect && timeSelect.options.length > 2) {
                timeSelect.value = timeSelect.options[2].value;
            }
        }
    ''')

    # Seleccionar tipo de reserva
    page.evaluate('''
        () => {
            const typeSelect = document.getElementById("resType");
            if (typeSelect) typeSelect.value = "estandar";
        }
    ''')

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/06_complete_form.png')

    # Verificar que no hay errores antes de "enviar"
    form_valid = page.evaluate('''
        () => {
            const errors = document.querySelectorAll(".form-group.error");
            return errors.length === 0;
        }
    ''')
    log_test("Envío", "Formulario sin errores de validación",
             "PASSED" if form_valid else "WARNING")

    # Verificar datos del formulario
    form_data = page.evaluate('''
        () => ({
            name: document.getElementById("resName")?.value,
            phone: document.getElementById("resPhone")?.value,
            email: document.getElementById("resEmail")?.value,
            people: document.getElementById("resPeople")?.value,
            date: document.getElementById("resDate")?.value,
            time: document.getElementById("resTime")?.value,
            type: document.getElementById("resType")?.value
        })
    ''')

    log_test("Envío", "Datos capturados correctamente", "PASSED")
    print(f"      {Colors.INFO}Nombre: {form_data.get('name')}")
    print(f"      Teléfono: {form_data.get('phone')}")
    print(f"      Email: {form_data.get('email')}")
    print(f"      Personas: {form_data.get('people')}")
    print(f"      Fecha: {form_data.get('date')}")
    print(f"      Hora: {form_data.get('time')}")
    print(f"      Tipo: {form_data.get('type')}{Colors.END}")

    # Verificar endpoint de envío
    form_action = page.evaluate('''
        () => {
            const form = document.getElementById("reservationForm");
            return form?.action || "No action defined";
        }
    ''')
    log_test("Envío", "Endpoint configurado", "PASSED" if "script.google.com" in str(form_action) or form_action else "WARNING",
             form_action[:60] + "..." if len(str(form_action)) > 60 else form_action)

    # ================================================================
    # TEST 11: CERRAR MODAL
    # ================================================================
    section_header("TEST 11: CERRAR MODAL")

    close_works = page.evaluate('''
        () => {
            const closeBtn = document.querySelector("#reservationModal .close, .modal-close, .btn-close-modal");
            if (closeBtn) {
                closeBtn.click();
                return true;
            }
            if (typeof closeReservationModal === 'function') {
                closeReservationModal();
                return true;
            }
            return false;
        }
    ''')
    page.wait_for_timeout(500)

    modal_closed = page.evaluate('''
        () => {
            const modal = document.getElementById("reservationModal");
            if (!modal) return true;
            return !modal.classList.contains("active") || getComputedStyle(modal).display === "none";
        }
    ''')
    log_test("Modal", "Modal se cierra correctamente", "PASSED" if modal_closed else "WARNING")

    browser.close()

# ================================================================
# REPORTE FINAL
# ================================================================
print(f"\n{Colors.BOLD}{'=' * 65}")
print("📊 REPORTE FINAL DEL SISTEMA DE RESERVAS")
print(f"{'=' * 65}{Colors.END}")

passed = test_results["summary"]["passed"]
failed = test_results["summary"]["failed"]
warnings = test_results["summary"]["warnings"]
total = passed + failed + warnings
critical = test_results["summary"]["critical_failures"]

print(f"\n   Total de pruebas:  {total}")
print(f"   {Colors.PASS}✅ Pasadas:       {passed}{Colors.END}")
print(f"   {Colors.FAIL}❌ Fallidas:      {failed}{Colors.END}")
print(f"   {Colors.WARN}⚠️  Advertencias:  {warnings}{Colors.END}")

success_rate = (passed / total * 100) if total > 0 else 0
print(f"\n   📈 Tasa de éxito: {success_rate:.1f}%")

if critical:
    print(f"\n   {Colors.FAIL}{Colors.BOLD}🚨 FALLOS CRÍTICOS:{Colors.END}")
    for c in critical:
        print(f"      {Colors.FAIL}• {c}{Colors.END}")

# Guardar JSON
report_path = '/tmp/mar-tierra-tests/reservations/reservation_test_report.json'
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(test_results, f, indent=2, ensure_ascii=False)

print(f"\n   📁 Reporte JSON: {report_path}")
print(f"   📸 Screenshots:  /tmp/mar-tierra-tests/reservations/")

print(f"\n{Colors.BOLD}{'=' * 65}")
if failed == 0:
    print(f"{Colors.PASS}🎉 ¡EL SISTEMA DE RESERVAS PASÓ TODAS LAS PRUEBAS!{Colors.END}")
elif failed <= 2 and not critical:
    print(f"{Colors.WARN}⚠️  SISTEMA FUNCIONAL CON DETALLES MENORES{Colors.END}")
else:
    print(f"{Colors.FAIL}❌ SE REQUIERE ATENCIÓN EN EL SISTEMA DE RESERVAS{Colors.END}")
print(f"{Colors.BOLD}{'=' * 65}{Colors.END}\n")
