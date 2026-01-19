#!/usr/bin/env python3
"""
Test del Sistema de Salones - Mar & Tierra Restaurant
Verifica el selector de salón y validación de capacidad
"""
from playwright.sync_api import sync_playwright
import os
from datetime import datetime, timedelta
import random

os.makedirs('/tmp/mar-tierra-tests/salon', exist_ok=True)

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
    print("🏛️  TEST DEL SISTEMA DE SALONES")
    print(f"   Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 65)

    # Cargar página
    cache_buster = random.randint(1000, 9999)
    page.goto(f'http://127.0.0.1:5501/?v={cache_buster}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # ================================================================
    # TEST: VERIFICAR CONSTANTE SALON_CAPACITIES
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 CONFIGURACIÓN DE SALONES")
    print("-" * 50)

    salon_config = page.evaluate('''
        () => {
            if (typeof SALON_CAPACITIES === 'undefined') return null;
            return SALON_CAPACITIES;
        }
    ''')

    log_test("SALON_CAPACITIES definido",
             "PASSED" if salon_config else "FAILED",
             "Constante no encontrada" if not salon_config else "")

    if salon_config:
        expected_salons = ['moon-terraza', 'golden', 'arca', 'barco', 'chill-out']
        for salon in expected_salons:
            has_salon = salon in salon_config
            log_test(f"Salón '{salon}' configurado",
                     "PASSED" if has_salon else "FAILED")
            if has_salon:
                capacity = salon_config[salon].get('capacity', 0)
                print(f"      └─ Capacidad: {capacity} personas")

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
    # TEST: SELECTOR DE SALÓN EXISTE
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 SELECTOR DE SALÓN")
    print("-" * 50)

    salon_exists = page.evaluate('!!document.getElementById("resSalon")')
    log_test("Selector de salón existe", "PASSED" if salon_exists else "FAILED")

    salon_options = page.evaluate('''
        Array.from(document.getElementById("resSalon")?.options || [])
            .map(o => ({ value: o.value, text: o.text, capacity: o.dataset.capacity }))
            .filter(o => o.value)
    ''')

    log_test(f"Opciones de salón: {len(salon_options)}",
             "PASSED" if len(salon_options) >= 5 else "FAILED")

    for opt in salon_options:
        print(f"      └─ {opt['text']} (cap: {opt.get('capacity', 'N/A')})")

    # ================================================================
    # TEST: FUNCIÓN updateSalonInfo
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 FUNCIÓN updateSalonInfo")
    print("-" * 50)

    update_fn_exists = page.evaluate('typeof updateSalonInfo === "function"')
    log_test("Función updateSalonInfo existe", "PASSED" if update_fn_exists else "FAILED")

    # Test: Seleccionar Golden y verificar mensaje especial
    page.evaluate('''
        () => {
            const salon = document.getElementById("resSalon");
            if (salon) {
                salon.value = "golden";
                salon.dispatchEvent(new Event("change", { bubbles: true }));
                if (typeof updateSalonInfo === "function") updateSalonInfo();
            }
        }
    ''')
    page.wait_for_timeout(500)

    golden_msg_visible = page.evaluate('''
        () => {
            const msg = document.getElementById("goldenExclusiveMsg");
            return msg && msg.style.display !== "none";
        }
    ''')
    log_test("Mensaje Golden visible al seleccionar Golden",
             "PASSED" if golden_msg_visible else "WARNING",
             "Mensaje especial de Golden no apareció" if not golden_msg_visible else "")

    salon_info_visible = page.evaluate('''
        () => {
            const info = document.getElementById("salonInfo");
            return info && info.style.display !== "none";
        }
    ''')
    log_test("Información del salón visible",
             "PASSED" if salon_info_visible else "WARNING")

    # ================================================================
    # TEST: VALIDACIÓN DE CAPACIDAD
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 VALIDACIÓN DE CAPACIDAD")
    print("-" * 50)

    # Test: Chill Out (8 personas) con 10 personas
    page.evaluate('''
        () => {
            const salon = document.getElementById("resSalon");
            const people = document.getElementById("resPeople");
            if (salon && people) {
                salon.value = "chill-out";
                people.value = "10";
                salon.dispatchEvent(new Event("change", { bubbles: true }));
                if (typeof updateSalonInfo === "function") updateSalonInfo();
            }
        }
    ''')
    page.wait_for_timeout(500)

    has_error = page.evaluate('''
        () => {
            const salonSelect = document.getElementById("resSalon");
            const formGroup = salonSelect?.closest(".form-group");
            return formGroup?.classList.contains("error") || false;
        }
    ''')
    log_test("Error al exceder capacidad (Chill Out: 10 > 8)",
             "PASSED" if has_error else "FAILED",
             "No se mostró error de capacidad" if not has_error else "")

    # Test: Arca (60 personas) con 10 personas - debería ser válido
    page.evaluate('''
        () => {
            const salon = document.getElementById("resSalon");
            const people = document.getElementById("resPeople");
            if (salon && people) {
                salon.value = "arca";
                people.value = "10";
                salon.dispatchEvent(new Event("change", { bubbles: true }));
                if (typeof updateSalonInfo === "function") updateSalonInfo();
            }
        }
    ''')
    page.wait_for_timeout(500)

    no_error = page.evaluate('''
        () => {
            const salonSelect = document.getElementById("resSalon");
            const formGroup = salonSelect?.closest(".form-group");
            return !formGroup?.classList.contains("error");
        }
    ''')
    log_test("Sin error con capacidad válida (Arca: 10 <= 60)",
             "PASSED" if no_error else "FAILED")

    # ================================================================
    # TEST: SALÓN EN CAMPOS REQUERIDOS
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 VALIDACIÓN DE FORMULARIO")
    print("-" * 50)

    # Verificar que resSalon está en los campos requeridos
    required_includes_salon = page.evaluate('''
        () => {
            // Intentar obtener los campos requeridos de la función de validación
            const fn = window.validateReservationForm?.toString() || "";
            return fn.includes("resSalon");
        }
    ''')
    log_test("Salón incluido en validación",
             "PASSED" if required_includes_salon else "FAILED")

    # ================================================================
    # TEST: FORMULARIO COMPLETO CON SALÓN
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 FORMULARIO COMPLETO CON SALÓN")
    print("-" * 50)

    # Llenar formulario completo
    next_saturday = datetime.now() + timedelta(days=(5 - datetime.now().weekday()) % 7 + 7)
    saturday_str = next_saturday.strftime('%Y-%m-%d')

    page.evaluate(f'''
        () => {{
            document.getElementById("resName").value = "Test Salón";
            document.getElementById("resPhone").value = "3001234567";
            document.getElementById("resEmail").value = "test@salon.com";
            document.getElementById("resPeople").value = "6";
            document.getElementById("resSalon").value = "golden";
            document.getElementById("resDate").value = "{saturday_str}";
            document.getElementById("resDate").dispatchEvent(new Event("change", {{ bubbles: true }}));
        }}
    ''')
    page.wait_for_timeout(600)

    # Seleccionar hora y tipo
    page.evaluate('''
        () => {
            const time = document.getElementById("resTime");
            if (time.options.length > 2) time.value = time.options[2].value;
            document.getElementById("resType").value = "estandar";
            if (typeof updateSalonInfo === "function") updateSalonInfo();
        }
    ''')
    page.wait_for_timeout(300)

    # Verificar datos del formulario
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

    log_test("Todos los campos llenos (incluyendo salón)",
             "PASSED" if all_filled else "FAILED")

    print(f"\n   📝 Datos del formulario:")
    print(f"      Nombre: {form_data.get('name')}")
    print(f"      Teléfono: {form_data.get('phone')}")
    print(f"      Email: {form_data.get('email')}")
    print(f"      Personas: {form_data.get('people')}")
    print(f"      Salón: {form_data.get('salon')}")
    print(f"      Fecha: {form_data.get('date')}")
    print(f"      Hora: {form_data.get('time')}")
    print(f"      Tipo: {form_data.get('type')}")

    # Screenshot
    page.screenshot(path='/tmp/mar-tierra-tests/salon/salon_test.png')

    browser.close()

# ================================================================
# RESUMEN
# ================================================================
print("\n" + "=" * 65)
print("📊 RESUMEN DEL TEST DE SALONES")
print("=" * 65)

passed = test_results["summary"]["passed"]
failed = test_results["summary"]["failed"]
warnings = test_results["summary"]["warnings"]
total = passed + failed + warnings

print(f"\n   Total: {total} | ✅ {passed} | ❌ {failed} | ⚠️ {warnings}")
print(f"   Tasa de éxito: {(passed/total*100):.1f}%")

print("\n" + "=" * 65)
if failed == 0:
    print("🎉 ¡SISTEMA DE SALONES FUNCIONANDO CORRECTAMENTE!")
elif failed <= 2:
    print("⚠️  SISTEMA FUNCIONAL CON ALGUNOS AJUSTES MENORES")
else:
    print("❌ REVISAR PROBLEMAS EN EL SISTEMA DE SALONES")
print("=" * 65 + "\n")
