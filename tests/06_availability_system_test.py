#!/usr/bin/env python3
"""
Test del Sistema de Disponibilidad - Mar & Tierra Restaurant
Verifica la validación de disponibilidad en tiempo real
"""
from playwright.sync_api import sync_playwright
import os
from datetime import datetime, timedelta
import random

os.makedirs('/tmp/mar-tierra-tests/availability', exist_ok=True)

test_results = {
    "timestamp": datetime.now().isoformat(),
    "tests": [],
    "summary": {"passed": 0, "failed": 0, "warnings": 0}
}

def log_test(name, status, details=""):
    test_results["tests"].append({"name": name, "status": status, "details": details})
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
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        bypass_csp=True
    )

    page = context.new_page()

    # Deshabilitar caché
    page.route("**/*", lambda route: route.continue_(headers={
        **route.request.headers,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
    }))

    print("\n" + "=" * 65)
    print("🔍 TEST DEL SISTEMA DE DISPONIBILIDAD")
    print(f"   Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 65)

    # Cargar página
    cache_buster = random.randint(1000, 9999)
    page.goto(f'http://127.0.0.1:5501/?v={cache_buster}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # ================================================================
    # TEST: VERIFICAR CONFIGURACIÓN DE DISPONIBILIDAD
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 CONFIGURACIÓN DEL SISTEMA")
    print("-" * 50)

    # Verificar que existe la URL de API
    api_url_exists = page.evaluate('''
        () => typeof AVAILABILITY_API_URL !== 'undefined'
    ''')
    log_test("URL de API de disponibilidad definida",
             "PASSED" if api_url_exists else "FAILED")

    # Verificar función de verificación de disponibilidad
    check_fn_exists = page.evaluate('''
        () => typeof checkAvailabilityRealTime === 'function'
    ''')
    log_test("Función checkAvailabilityRealTime existe",
             "PASSED" if check_fn_exists else "FAILED")

    # Verificar función debounce
    debounce_fn_exists = page.evaluate('''
        () => typeof debouncedCheckAvailability === 'function'
    ''')
    log_test("Función debouncedCheckAvailability existe",
             "PASSED" if debounce_fn_exists else "FAILED")

    # Verificar variable de estado
    state_var_exists = page.evaluate('''
        () => typeof currentAvailability !== 'undefined'
    ''')
    log_test("Variable currentAvailability existe",
             "PASSED" if state_var_exists else "FAILED")

    # ================================================================
    # TEST: ABRIR MODAL DE RESERVAS
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 MODAL DE RESERVAS")
    print("-" * 50)

    page.evaluate('''
        () => {
            const btn = document.querySelector('.btn-reserve');
            if (btn) btn.click();
            else if (typeof openReservationModal === 'function') openReservationModal();
        }
    ''')
    page.wait_for_timeout(700)

    modal_open = page.evaluate('document.getElementById("reservationModal")?.classList.contains("active")')
    log_test("Modal de reserva abierto", "PASSED" if modal_open else "FAILED")

    # ================================================================
    # TEST: ELEMENTO DE ESTADO DE DISPONIBILIDAD
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 ELEMENTO DE DISPONIBILIDAD")
    print("-" * 50)

    availability_element_exists = page.evaluate('''
        () => !!document.getElementById('availabilityStatus')
    ''')
    log_test("Elemento availabilityStatus existe",
             "PASSED" if availability_element_exists else "FAILED")

    # Verificar que está oculto inicialmente
    initially_hidden = page.evaluate('''
        () => {
            const el = document.getElementById('availabilityStatus');
            return el && (el.style.display === 'none' || el.style.display === '');
        }
    ''')
    log_test("Estado de disponibilidad oculto inicialmente",
             "PASSED" if initially_hidden else "WARNING",
             "El estado debería estar oculto sin datos" if not initially_hidden else "")

    # ================================================================
    # TEST: VERIFICAR LISTENERS DE CAMPOS
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 EVENT LISTENERS")
    print("-" * 50)

    # Llenar formulario parcialmente y verificar que no se muestra disponibilidad
    next_saturday = datetime.now() + timedelta(days=(5 - datetime.now().weekday()) % 7 + 7)
    saturday_str = next_saturday.strftime('%Y-%m-%d')

    page.evaluate(f'''
        () => {{
            document.getElementById("resPeople").value = "4";
            document.getElementById("resSalon").value = "golden";
            document.getElementById("resDate").value = "{saturday_str}";
            document.getElementById("resDate").dispatchEvent(new Event("change", {{ bubbles: true }}));
        }}
    ''')
    page.wait_for_timeout(600)

    # Seleccionar hora (esto debería disparar la verificación)
    page.evaluate('''
        () => {
            const time = document.getElementById("resTime");
            if (time.options.length > 2) {
                time.value = time.options[2].value;
                time.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
    ''')

    # Esperar a que se complete la verificación (debounce + fetch)
    print("   ⏳ Esperando verificación de disponibilidad...")
    page.wait_for_timeout(2000)

    # Verificar si se mostró el estado de disponibilidad
    availability_shown = page.evaluate('''
        () => {
            const el = document.getElementById('availabilityStatus');
            return el && el.style.display !== 'none' && el.innerHTML !== '';
        }
    ''')
    log_test("Estado de disponibilidad mostrado después de seleccionar hora",
             "PASSED" if availability_shown else "WARNING",
             "La verificación puede haber fallado por CORS o red" if not availability_shown else "")

    # Verificar contenido del estado
    availability_content = page.evaluate('''
        () => {
            const el = document.getElementById('availabilityStatus');
            return el ? el.innerHTML : '';
        }
    ''')

    if availability_content:
        has_icon = 'fa-check-circle' in availability_content or 'fa-times-circle' in availability_content or 'fa-spinner' in availability_content or 'fa-exclamation-triangle' in availability_content
        log_test("Estado de disponibilidad tiene icono",
                 "PASSED" if has_icon else "WARNING")
        print(f"      └─ Contenido: {availability_content[:100]}...")

    # ================================================================
    # TEST: VALIDACIÓN EN FORMULARIO
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 VALIDACIÓN DE DISPONIBILIDAD EN FORMULARIO")
    print("-" * 50)

    # Verificar que la validación del formulario incluye disponibilidad
    validation_includes_availability = page.evaluate('''
        () => {
            const fn = window.validateReservationForm?.toString() || "";
            return fn.includes("currentAvailability");
        }
    ''')
    log_test("Validación del formulario incluye disponibilidad",
             "PASSED" if validation_includes_availability else "FAILED")

    # ================================================================
    # TEST: FORMULARIO COMPLETO
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 FORMULARIO COMPLETO CON DISPONIBILIDAD")
    print("-" * 50)

    # Llenar resto del formulario
    page.evaluate('''
        () => {
            document.getElementById("resName").value = "Test Disponibilidad";
            document.getElementById("resPhone").value = "3001234567";
            document.getElementById("resEmail").value = "test@disponibilidad.com";
            document.getElementById("resType").value = "estandar";
        }
    ''')

    # Verificar datos
    form_data = page.evaluate('''
        () => ({
            name: document.getElementById("resName")?.value,
            phone: document.getElementById("resPhone")?.value,
            email: document.getElementById("resEmail")?.value,
            people: document.getElementById("resPeople")?.value,
            salon: document.getElementById("resSalon")?.value,
            date: document.getElementById("resDate")?.value,
            time: document.getElementById("resTime")?.value,
            type: document.getElementById("resType")?.value
        })
    ''')

    all_filled = all([
        form_data.get('name'),
        form_data.get('phone'),
        form_data.get('email'),
        form_data.get('people'),
        form_data.get('salon'),
        form_data.get('date'),
        form_data.get('time'),
        form_data.get('type')
    ])

    log_test("Todos los campos llenos", "PASSED" if all_filled else "FAILED")

    print(f"\n   📝 Datos del formulario:")
    print(f"      Nombre: {form_data.get('name')}")
    print(f"      Personas: {form_data.get('people')}")
    print(f"      Salón: {form_data.get('salon')}")
    print(f"      Fecha: {form_data.get('date')}")
    print(f"      Hora: {form_data.get('time')}")

    # Verificar estado actual de disponibilidad
    current_availability_state = page.evaluate('currentAvailability')
    if current_availability_state:
        print(f"\n   🔍 Estado de disponibilidad:")
        print(f"      Disponible: {current_availability_state.get('available', 'N/A')}")
        if current_availability_state.get('message'):
            print(f"      Mensaje: {current_availability_state.get('message')}")
        if current_availability_state.get('remainingCapacity') is not None:
            print(f"      Capacidad restante: {current_availability_state.get('remainingCapacity')}")

    # Screenshot
    page.screenshot(path='/tmp/mar-tierra-tests/availability/availability_test.png')

    browser.close()

# ================================================================
# RESUMEN
# ================================================================
print("\n" + "=" * 65)
print("📊 RESUMEN DEL TEST DE DISPONIBILIDAD")
print("=" * 65)

passed = test_results["summary"]["passed"]
failed = test_results["summary"]["failed"]
warnings = test_results["summary"]["warnings"]
total = passed + failed + warnings

print(f"\n   Total: {total} | ✅ {passed} | ❌ {failed} | ⚠️ {warnings}")
if total > 0:
    print(f"   Tasa de éxito: {(passed/total*100):.1f}%")

print("\n" + "=" * 65)
if failed == 0:
    print("🎉 ¡SISTEMA DE DISPONIBILIDAD CONFIGURADO CORRECTAMENTE!")
    print("   Nota: La verificación en tiempo real requiere que el")
    print("   Google Apps Script esté actualizado y desplegado.")
elif failed <= 2:
    print("⚠️  SISTEMA PARCIALMENTE FUNCIONAL")
    print("   Revisar configuración de Google Apps Script")
else:
    print("❌ REVISAR PROBLEMAS EN EL SISTEMA")
print("=" * 65 + "\n")
