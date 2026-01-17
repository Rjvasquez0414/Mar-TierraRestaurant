#!/usr/bin/env python3
"""
Reconocimiento inicial de la página Mar & Tierra Restaurant
"""
from playwright.sync_api import sync_playwright
import os

# Crear directorio para screenshots
os.makedirs('/tmp/mar-tierra-tests', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})

    print("=" * 60)
    print("🔍 RECONOCIMIENTO INICIAL - Mar & Tierra Restaurant")
    print("=" * 60)

    # Navegar a la página
    print("\n📡 Conectando a http://127.0.0.1:5501/...")
    page.goto('http://127.0.0.1:5501/')
    page.wait_for_load_state('networkidle')
    print("✅ Página cargada correctamente")

    # Esperar a que el preloader desaparezca
    print("\n⏳ Esperando que el preloader desaparezca...")
    page.wait_for_timeout(3000)

    # Screenshot de la página completa
    print("\n📸 Capturando screenshot de página completa...")
    page.screenshot(path='/tmp/mar-tierra-tests/01_homepage_full.png', full_page=True)
    print("   Guardado: /tmp/mar-tierra-tests/01_homepage_full.png")

    # Screenshot del hero
    page.screenshot(path='/tmp/mar-tierra-tests/02_hero_section.png')
    print("   Guardado: /tmp/mar-tierra-tests/02_hero_section.png")

    # Obtener información del DOM
    print("\n📊 ESTRUCTURA DE LA PÁGINA:")
    print("-" * 40)

    # Título
    title = page.title()
    print(f"   Título: {title}")

    # Secciones principales
    sections = page.locator('section').all()
    print(f"   Secciones encontradas: {len(sections)}")

    # Links de navegación
    nav_links = page.locator('nav a, .nav-links a').all()
    print(f"   Links de navegación: {len(nav_links)}")

    # Botones
    buttons = page.locator('button, .btn').all()
    print(f"   Botones: {len(buttons)}")

    # Formularios
    forms = page.locator('form').all()
    print(f"   Formularios: {len(forms)}")

    # Imágenes
    images = page.locator('img').all()
    print(f"   Imágenes: {len(images)}")

    # Buscar elementos clave del restaurante
    print("\n🍽️  ELEMENTOS ESPECÍFICOS DEL RESTAURANTE:")
    print("-" * 40)

    # Menú items
    menu_items = page.locator('.menu-item').all()
    print(f"   Items del menú: {len(menu_items)}")

    # Filtros del menú
    filter_btns = page.locator('.filter-btn').all()
    print(f"   Botones de filtro: {len(filter_btns)}")

    # Campo de búsqueda
    search_input = page.locator('.search-input, input[type="search"]').count()
    print(f"   Campo de búsqueda: {'✅ Presente' if search_input > 0 else '❌ No encontrado'}")

    # Modal de reserva
    reservation_modal = page.locator('#reservationModal, .reservation-modal').count()
    print(f"   Modal de reserva: {'✅ Presente' if reservation_modal > 0 else '❌ No encontrado'}")

    # Formulario de reserva
    res_form = page.locator('#reservationForm').count()
    print(f"   Formulario de reserva: {'✅ Presente' if res_form > 0 else '❌ No encontrado'}")

    # Campos del formulario de reserva
    print("\n📝 CAMPOS DEL FORMULARIO DE RESERVA:")
    print("-" * 40)
    form_fields = ['resName', 'resPhone', 'resEmail', 'resPeople', 'resDate', 'resTime', 'resType']
    for field_id in form_fields:
        field = page.locator(f'#{field_id}').count()
        print(f"   {field_id}: {'✅' if field > 0 else '❌'}")

    # Verificar consola por errores
    print("\n🔧 VERIFICACIÓN DE CONSOLA:")
    print("-" * 40)

    # Recargar para capturar logs
    console_errors = []
    page.on('console', lambda msg: console_errors.append(msg) if msg.type == 'error' else None)
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    if console_errors:
        print(f"   ⚠️  Errores en consola: {len(console_errors)}")
        for err in console_errors[:5]:
            print(f"      - {err.text[:80]}...")
    else:
        print("   ✅ Sin errores en consola")

    browser.close()

    print("\n" + "=" * 60)
    print("✅ RECONOCIMIENTO COMPLETADO")
    print("=" * 60)
