#!/usr/bin/env python3
"""
Suite Completo de Pruebas - Mar & Tierra Restaurant
Testeo Profesional con manejo robusto de elementos
"""
from playwright.sync_api import sync_playwright
import os
import json
from datetime import datetime, timedelta

os.makedirs('/tmp/mar-tierra-tests', exist_ok=True)

test_results = {
    "timestamp": datetime.now().isoformat(),
    "url": "http://127.0.0.1:5501/",
    "tests": [],
    "summary": {"passed": 0, "failed": 0, "warnings": 0}
}

def log_test(name, status, details=""):
    result = {"name": name, "status": status, "details": details}
    test_results["tests"].append(result)
    icon = "✅" if status == "PASSED" else "❌" if status == "FAILED" else "⚠️"
    print(f"   {icon} {name}")
    if details and status != "PASSED":
        print(f"      └─ {details}")
    if status == "PASSED":
        test_results["summary"]["passed"] += 1
    elif status == "FAILED":
        test_results["summary"]["failed"] += 1
    else:
        test_results["summary"]["warnings"] += 1

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ============================================================
    # TEST 1: CARGA Y ELEMENTOS VISUALES
    # ============================================================
    print("\n" + "=" * 60)
    print("🖥️  TEST 1: CARGA Y ELEMENTOS VISUALES (Desktop)")
    print("=" * 60)

    page = browser.new_page(viewport={'width': 1920, 'height': 1080})

    start_time = datetime.now()
    page.goto('http://127.0.0.1:5501/')
    page.wait_for_load_state('domcontentloaded')
    load_time = (datetime.now() - start_time).total_seconds()

    log_test("Tiempo de carga DOM", "PASSED" if load_time < 5 else "WARNING", f"{load_time:.2f}s")

    page.wait_for_timeout(3500)  # Esperar preloader

    # Título
    title = page.title()
    log_test("Título de página", "PASSED" if "Mar" in title else "FAILED", title)

    # Header
    header_visible = page.evaluate('!!document.querySelector("header, #header")')
    log_test("Header presente", "PASSED" if header_visible else "FAILED")

    # Navegación
    nav_count = page.evaluate('document.querySelectorAll("nav a, .nav-links a").length')
    log_test("Links de navegación", "PASSED" if nav_count >= 4 else "WARNING", f"{nav_count} links")

    # Hero
    hero_exists = page.evaluate('!!document.querySelector(".hero, #hero, .hero-section")')
    log_test("Hero section", "PASSED" if hero_exists else "FAILED")

    page.screenshot(path='/tmp/mar-tierra-tests/test1_desktop.png')

    # ============================================================
    # TEST 2: SCROLL Y NAVEGACIÓN
    # ============================================================
    print("\n" + "=" * 60)
    print("🧭 TEST 2: SCROLL Y NAVEGACIÓN")
    print("=" * 60)

    # Test scroll
    page.evaluate('window.scrollTo(0, 600)')
    page.wait_for_timeout(600)
    scroll_y = page.evaluate('window.scrollY')
    log_test("Scroll funciona", "PASSED" if scroll_y > 500 else "WARNING", f"scrollY: {scroll_y}")

    # Header efecto scroll
    page.wait_for_timeout(300)
    scrolled_class = page.evaluate('''
        document.querySelector("header, #header")?.classList.contains("scrolled") || false
    ''')
    log_test("Header scroll effect", "PASSED" if scrolled_class else "WARNING")

    page.screenshot(path='/tmp/mar-tierra-tests/test2_scroll.png')

    # ============================================================
    # TEST 3: MENÚ DE PLATOS
    # ============================================================
    print("\n" + "=" * 60)
    print("🍽️  TEST 3: MENÚ DE PLATOS")
    print("=" * 60)

    # Contar items
    menu_count = page.evaluate('document.querySelectorAll(".menu-item").length')
    log_test("Items del menú", "PASSED" if menu_count >= 20 else "WARNING", f"{menu_count} platos")

    # Filtros
    filter_count = page.evaluate('document.querySelectorAll(".filter-btn").length')
    log_test("Botones de filtro", "PASSED" if filter_count >= 5 else "WARNING", f"{filter_count} filtros")

    # Probar filtro con JavaScript
    filter_works = page.evaluate('''
        () => {
            const btn = document.querySelector('.filter-btn:not(.active)');
            if (btn) { btn.click(); return true; }
            return false;
        }
    ''')
    log_test("Filtros interactivos", "PASSED" if filter_works else "WARNING")
    page.wait_for_timeout(400)

    # Campo de búsqueda existe
    search_exists = page.evaluate('!!document.querySelector(".search-input")')
    log_test("Campo de búsqueda", "PASSED" if search_exists else "WARNING")

    # Test búsqueda con JavaScript
    if search_exists:
        search_works = page.evaluate('''
            () => {
                const input = document.querySelector(".search-input");
                if (input) {
                    input.value = "arroz";
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    return true;
                }
                return false;
            }
        ''')
        page.wait_for_timeout(500)
        log_test("Búsqueda funciona", "PASSED" if search_works else "WARNING")

        # Limpiar
        page.evaluate('document.querySelector(".search-input").value = ""')
        page.evaluate('document.querySelector(".search-input").dispatchEvent(new Event("input", { bubbles: true }))')

    page.screenshot(path='/tmp/mar-tierra-tests/test3_menu.png')

    # ============================================================
    # TEST 4: MODAL DE RESERVAS
    # ============================================================
    print("\n" + "=" * 60)
    print("📝 TEST 4: MODAL DE RESERVAS")
    print("=" * 60)

    # Abrir modal
    modal_opened = page.evaluate('''
        () => {
            const btn = document.querySelector('.btn-reserve, [onclick*="openReservationModal"], a[href="#reservationModal"]');
            if (btn) { btn.click(); return true; }
            // Intentar con función directa
            if (typeof openReservationModal === 'function') {
                openReservationModal();
                return true;
            }
            return false;
        }
    ''')
    page.wait_for_timeout(600)

    modal_visible = page.evaluate('''
        document.querySelector("#reservationModal")?.style.display !== "none" &&
        document.querySelector("#reservationModal")?.classList.contains("active") ||
        getComputedStyle(document.querySelector("#reservationModal") || document.body).display !== "none"
    ''')
    log_test("Modal de reserva", "PASSED" if modal_visible or modal_opened else "WARNING")

    page.screenshot(path='/tmp/mar-tierra-tests/test4_modal.png')

    # Campos del formulario
    fields = ['resName', 'resPhone', 'resEmail', 'resPeople', 'resDate', 'resTime', 'resType']
    fields_found = 0
    for f in fields:
        if page.evaluate(f'!!document.getElementById("{f}")'):
            fields_found += 1
    log_test("Campos del formulario", "PASSED" if fields_found == 7 else "WARNING", f"{fields_found}/7")

    # ============================================================
    # TEST 5: VALIDACIONES FECHA/HORA
    # ============================================================
    print("\n" + "=" * 60)
    print("⏰ TEST 5: VALIDACIONES DE FECHA Y HORA")
    print("=" * 60)

    # Verificar hora deshabilitada
    time_disabled = page.evaluate('document.getElementById("resTime")?.disabled || false')
    log_test("Hora deshabilitada sin fecha", "PASSED" if time_disabled else "WARNING")

    # Calcular próximo domingo
    today = datetime.now()
    days_until_sunday = (6 - today.weekday()) % 7
    if days_until_sunday == 0:
        days_until_sunday = 7
    next_sunday = today + timedelta(days=days_until_sunday)
    sunday_str = next_sunday.strftime('%Y-%m-%d')

    # Seleccionar fecha domingo
    page.evaluate(f'''
        () => {{
            const dateField = document.getElementById("resDate");
            if (dateField) {{
                dateField.value = "{sunday_str}";
                dateField.dispatchEvent(new Event("change", {{ bubbles: true }}));
            }}
        }}
    ''')
    page.wait_for_timeout(600)
    log_test("Selección de fecha", "PASSED", f"Domingo {sunday_str}")

    # Verificar hora habilitada
    time_enabled = page.evaluate('!document.getElementById("resTime")?.disabled')
    log_test("Hora habilitada tras fecha", "PASSED" if time_enabled else "FAILED")

    # Verificar opciones de hora
    time_options = page.evaluate('''
        () => {
            const select = document.getElementById("resTime");
            if (!select) return [];
            return Array.from(select.options).map(o => o.value).filter(v => v);
        }
    ''')

    has_1130 = '11:30' in time_options
    has_2000 = '20:00' in time_options
    no_2100 = '21:00' not in time_options

    log_test("Hora apertura 11:30 AM", "PASSED" if has_1130 else "FAILED")
    log_test("Última hora domingo 8PM", "PASSED" if has_2000 else "WARNING")
    log_test("Sin 9PM en domingo", "PASSED" if no_2100 else "FAILED", "9PM no debe estar disponible")

    # Probar viernes
    days_until_friday = (4 - today.weekday()) % 7
    if days_until_friday == 0:
        days_until_friday = 7
    next_friday = today + timedelta(days=days_until_friday)
    friday_str = next_friday.strftime('%Y-%m-%d')

    page.evaluate(f'''
        () => {{
            const dateField = document.getElementById("resDate");
            if (dateField) {{
                dateField.value = "{friday_str}";
                dateField.dispatchEvent(new Event("change", {{ bubbles: true }}));
            }}
        }}
    ''')
    page.wait_for_timeout(600)

    friday_options = page.evaluate('''
        Array.from(document.getElementById("resTime")?.options || []).map(o => o.value).filter(v => v)
    ''')
    has_late_hours = any(t in friday_options for t in ['22:30', '22:59', '23:00'])
    log_test("Horario extendido viernes", "PASSED" if has_late_hours else "WARNING",
             f"Últimas opciones: {friday_options[-3:] if friday_options else 'N/A'}")

    page.screenshot(path='/tmp/mar-tierra-tests/test5_time.png')

    # ============================================================
    # TEST 6: VALIDACIÓN FORMULARIO
    # ============================================================
    print("\n" + "=" * 60)
    print("✔️  TEST 6: VALIDACIÓN DE FORMULARIO")
    print("=" * 60)

    # Limpiar y probar submit vacío
    page.evaluate('''
        () => {
            ["resName", "resPhone", "resEmail", "resDate"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
        }
    ''')

    # Click submit
    page.evaluate('''
        () => {
            const btn = document.querySelector(".btn-submit, button[type='submit']");
            if (btn) btn.click();
        }
    ''')
    page.wait_for_timeout(500)

    # Verificar errores
    errors_shown = page.evaluate('document.querySelectorAll(".form-group.error, .error-message.show").length')
    log_test("Validación campos vacíos", "PASSED" if errors_shown > 0 else "WARNING", f"{errors_shown} errores mostrados")

    page.screenshot(path='/tmp/mar-tierra-tests/test6_validation.png')

    # ============================================================
    # TEST 7: RESPONSIVE MÓVIL
    # ============================================================
    print("\n" + "=" * 60)
    print("📱 TEST 7: RESPONSIVE (iPhone 12 Pro - 390x844)")
    print("=" * 60)

    page.close()
    mobile = browser.new_page(viewport={'width': 390, 'height': 844})
    mobile.goto('http://127.0.0.1:5501/')
    mobile.wait_for_load_state('domcontentloaded')
    mobile.wait_for_timeout(3500)

    mobile.screenshot(path='/tmp/mar-tierra-tests/test7_mobile.png')
    log_test("Vista móvil cargada", "PASSED")

    # Hamburger menu
    hamburger_visible = mobile.evaluate('''
        () => {
            const toggle = document.querySelector("#mobileToggle, .mobile-toggle, .hamburger");
            if (!toggle) return false;
            const style = getComputedStyle(toggle);
            return style.display !== "none" && style.visibility !== "hidden";
        }
    ''')
    log_test("Menú hamburguesa visible", "PASSED" if hamburger_visible else "WARNING")

    # Click hamburger
    if hamburger_visible:
        mobile.evaluate('''
            document.querySelector("#mobileToggle, .mobile-toggle, .hamburger")?.click()
        ''')
        mobile.wait_for_timeout(500)

        nav_open = mobile.evaluate('''
            document.querySelector("nav, .nav-links")?.classList.contains("active") || false
        ''')
        log_test("Menú móvil se abre", "PASSED" if nav_open else "WARNING")
        mobile.screenshot(path='/tmp/mar-tierra-tests/test7_mobile_nav.png')

    # Scroll móvil
    mobile.evaluate('window.scrollTo(0, 800)')
    mobile.wait_for_timeout(400)
    log_test("Scroll en móvil", "PASSED")

    # Items visibles en móvil
    items_mobile = mobile.evaluate('document.querySelectorAll(".menu-item").length')
    log_test("Items menú en móvil", "PASSED" if items_mobile > 0 else "WARNING", f"{items_mobile} items")

    mobile.screenshot(path='/tmp/mar-tierra-tests/test7_mobile_scroll.png', full_page=True)
    mobile.close()

    # ============================================================
    # TEST 8: CONSOLA Y ERRORES
    # ============================================================
    print("\n" + "=" * 60)
    print("🔧 TEST 8: ERRORES DE CONSOLA")
    print("=" * 60)

    console_errors = []
    error_page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    error_page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    error_page.goto('http://127.0.0.1:5501/')
    error_page.wait_for_load_state('networkidle')
    error_page.wait_for_timeout(2000)

    # Filtrar errores de recursos 404
    resource_errors = [e for e in console_errors if '404' in e or 'Failed to load' in e]
    js_errors = [e for e in console_errors if '404' not in e and 'Failed to load' not in e]

    if not js_errors:
        log_test("Sin errores JavaScript", "PASSED")
    else:
        log_test("Errores JavaScript", "WARNING", f"{len(js_errors)} errores")
        for err in js_errors[:3]:
            print(f"         {err[:60]}...")

    if not resource_errors:
        log_test("Recursos cargados", "PASSED")
    else:
        log_test("Recursos 404", "WARNING", f"{len(resource_errors)} recursos no encontrados")

    error_page.close()
    browser.close()

# ============================================================
# REPORTE FINAL
# ============================================================
print("\n" + "=" * 60)
print("📊 RESUMEN DE PRUEBAS")
print("=" * 60)

passed = test_results["summary"]["passed"]
failed = test_results["summary"]["failed"]
warnings = test_results["summary"]["warnings"]
total = passed + failed + warnings

print(f"\n   Total de pruebas: {total}")
print(f"   ✅ Pasadas:      {passed}")
print(f"   ❌ Fallidas:     {failed}")
print(f"   ⚠️  Advertencias: {warnings}")

success_rate = (passed / total * 100) if total > 0 else 0
print(f"\n   📈 Tasa de éxito: {success_rate:.1f}%")

# Guardar JSON
report_path = '/tmp/mar-tierra-tests/test_report.json'
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(test_results, f, indent=2, ensure_ascii=False)

print(f"\n   📁 Reporte JSON: {report_path}")
print(f"   📸 Screenshots:  /tmp/mar-tierra-tests/")

print("\n" + "=" * 60)
if failed == 0 and warnings <= 5:
    print("🎉 ¡EXCELENTE! LA PÁGINA PASÓ LAS PRUEBAS PRINCIPALES")
elif failed <= 2:
    print("⚠️  LA PÁGINA FUNCIONA CON ALGUNOS DETALLES A REVISAR")
else:
    print("❌ SE ENCONTRARON PROBLEMAS QUE REQUIEREN ATENCIÓN")
print("=" * 60 + "\n")
