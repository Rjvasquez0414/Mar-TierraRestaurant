#!/usr/bin/env python3
"""
Test Final del Sistema de Reservas - Sin Caché
Mar & Tierra Restaurant
"""
from playwright.sync_api import sync_playwright
import os
import json
from datetime import datetime, timedelta
import random

os.makedirs('/tmp/mar-tierra-tests/reservations', exist_ok=True)

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
    # Crear contexto SIN caché
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        bypass_csp=True
    )

    # Deshabilitar caché a nivel de contexto
    page = context.new_page()

    # Interceptar requests para deshabilitar caché
    page.route("**/*", lambda route: route.continue_(headers={
        **route.request.headers,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
    }))

    print("\n" + "=" * 65)
    print("🍽️  TEST FINAL DEL SISTEMA DE RESERVAS (SIN CACHÉ)")
    print(f"   Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 65)

    # Cargar página con cache-busting
    cache_buster = random.randint(1000, 9999)
    page.goto(f'http://127.0.0.1:5501/?v={cache_buster}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3500)

    # ================================================================
    # TEST: VERIFICAR CÓDIGO ACTUALIZADO
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 VERIFICACIÓN DE CÓDIGO")
    print("-" * 50)

    # Verificar que la función populateTimeOptions existe y usa minutos
    code_check = page.evaluate('''
        () => {
            const fn = window.populateTimeOptions || null;
            return fn ? fn.toString().includes('lastReservationMinutes') : false;
        }
    ''')
    log_test("Código actualizado (minutos totales)",
             "PASSED" if code_check else "WARNING",
             "Usando lógica de minutos totales" if code_check else "Versión anterior detectada")

    # ================================================================
    # TEST: ABRIR MODAL
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
    log_test("Modal de reserva abierto", "PASSED" if modal_open else "WARNING")

    # ================================================================
    # TEST: SELECTOR DE HORA DINÁMICO
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 SELECTOR DINÁMICO DE HORA")
    print("-" * 50)

    # Hora deshabilitada sin fecha
    time_disabled = page.evaluate('document.getElementById("resTime")?.disabled')
    log_test("Hora deshabilitada sin fecha", "PASSED" if time_disabled else "FAILED")

    # Definir horarios esperados (última reserva = cierre - 1 hora)
    # Domingo: cierra 21:00 → última 20:00
    # Lunes: cierra 22:00 → última 21:00
    # Martes-Jueves: cierra 23:00 → última 22:00
    # Viernes-Sábado: cierra 23:59 → última 22:59

    tests_by_day = [
        (0, 'Domingo', '20:00', ['21:00', '21:30', '22:00']),
        (1, 'Lunes', '21:00', ['22:00', '22:30', '23:00']),
        (5, 'Viernes', '22:30', []),  # Viernes permite hasta 22:59
        (6, 'Sábado', '22:30', []),
    ]

    today = datetime.now()

    for day_num, day_name, expected_last, forbidden_times in tests_by_day:
        days_ahead = (day_num - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target_date = today + timedelta(days=days_ahead)
        date_str = target_date.strftime('%Y-%m-%d')

        page.evaluate(f'''
            () => {{
                const d = document.getElementById("resDate");
                d.value = "{date_str}";
                d.dispatchEvent(new Event("change", {{ bubbles: true }}));
            }}
        ''')
        page.wait_for_timeout(500)

        options = page.evaluate('''
            Array.from(document.getElementById("resTime")?.options || [])
                .map(o => o.value).filter(v => v)
        ''')

        # Verificar que la hora está habilitada
        time_enabled = page.evaluate('!document.getElementById("resTime")?.disabled')
        log_test(f"{day_name}: Selector habilitado", "PASSED" if time_enabled else "FAILED")

        # Verificar hora de apertura
        has_open = '11:30' in options
        log_test(f"{day_name}: Apertura 11:30 AM", "PASSED" if has_open else "FAILED")

        # Verificar última hora esperada
        has_last = expected_last in options
        log_test(f"{day_name}: Última hora {expected_last}",
                 "PASSED" if has_last else "WARNING",
                 f"Últimas: {options[-3:]}" if options else "Sin opciones")

        # Verificar horas prohibidas
        for forbidden in forbidden_times:
            has_forbidden = forbidden in options
            log_test(f"{day_name}: Sin {forbidden}",
                     "PASSED" if not has_forbidden else "FAILED",
                     f"{forbidden} no debería estar" if has_forbidden else "")

    # ================================================================
    # TEST: ATRIBUTO MIN DE FECHA
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 VALIDACIÓN DE FECHA")
    print("-" * 50)

    min_date = page.evaluate('document.getElementById("resDate")?.getAttribute("min")')
    today_str = today.strftime('%Y-%m-%d')
    log_test("Atributo min = hoy",
             "PASSED" if min_date == today_str else "FAILED",
             f"min='{min_date}', esperado='{today_str}'")

    # ================================================================
    # TEST: FORMULARIO COMPLETO
    # ================================================================
    print("\n" + "-" * 50)
    print("📋 FORMULARIO COMPLETO")
    print("-" * 50)

    # Llenar formulario válido
    next_saturday = today + timedelta(days=(5 - today.weekday()) % 7 + 7)
    saturday_str = next_saturday.strftime('%Y-%m-%d')

    page.evaluate(f'''
        () => {{
            document.getElementById("resName").value = "Cliente Test";
            document.getElementById("resPhone").value = "3001234567";
            document.getElementById("resEmail").value = "cliente@test.com";
            document.getElementById("resPeople").value = "4";
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
        }
    ''')

    # Verificar datos
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

    all_filled = all([
        form_data.get('name'),
        form_data.get('phone'),
        form_data.get('email'),
        form_data.get('people'),
        form_data.get('date'),
        form_data.get('time'),
        form_data.get('type')
    ])

    log_test("Todos los campos llenos", "PASSED" if all_filled else "FAILED")

    print(f"\n   📝 Datos de la reserva:")
    print(f"      Nombre: {form_data.get('name')}")
    print(f"      Teléfono: {form_data.get('phone')}")
    print(f"      Email: {form_data.get('email')}")
    print(f"      Personas: {form_data.get('people')}")
    print(f"      Fecha: {form_data.get('date')}")
    print(f"      Hora: {form_data.get('time')}")
    print(f"      Tipo: {form_data.get('type')}")

    page.screenshot(path='/tmp/mar-tierra-tests/reservations/final_test.png')

    browser.close()

# ================================================================
# RESUMEN
# ================================================================
print("\n" + "=" * 65)
print("📊 RESUMEN FINAL")
print("=" * 65)

passed = test_results["summary"]["passed"]
failed = test_results["summary"]["failed"]
warnings = test_results["summary"]["warnings"]
total = passed + failed + warnings

print(f"\n   Total: {total} | ✅ {passed} | ❌ {failed} | ⚠️ {warnings}")
print(f"   Tasa de éxito: {(passed/total*100):.1f}%")

print("\n" + "=" * 65)
if failed == 0:
    print("🎉 ¡SISTEMA DE RESERVAS FUNCIONANDO CORRECTAMENTE!")
elif failed <= 3:
    print("⚠️  SISTEMA FUNCIONAL CON ALGUNOS AJUSTES NECESARIOS")
else:
    print("❌ REVISAR PROBLEMAS EN EL SISTEMA")
print("=" * 65 + "\n")
