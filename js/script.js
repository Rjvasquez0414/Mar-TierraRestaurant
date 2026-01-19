// Menu App - Mar&Tierra Restaurant
class MenuApp {
    constructor() {
        this.currentSection = 'hero';
        this.menuData = {};
        this.filteredItems = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        
        this.init();
    }

    async init() {
        // Wait for DOM to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.setupEventListeners();
        this.loadMenuData();
        this.setupPreloader();
        this.setupScrollEffects();
        this.setupIntersectionObserver();
        this.setupModalEventListeners();
    }

    // Preloader functionality
    setupPreloader() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const preloader = document.getElementById('preloader');
                if (preloader) {
                    preloader.classList.add('fade-out');
                    // Add elegant entrance animation to hero
                    document.querySelectorAll('.hero-content > *').forEach((el, index) => {
                        el.style.animationDelay = `${index * 0.2}s`;
                        el.classList.add('fade-in');
                    });
                }
            }, 2000);
        });
    }

    // Header scroll effects with smooth transitions
    setupScrollEffects() {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const header = document.getElementById('header');
            if (!header) return;

            const currentScroll = window.scrollY;

            // Add/remove scrolled class with smooth transition
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            // Hide/show header on scroll with premium effect
            if (currentScroll > lastScroll && currentScroll > 100) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }

            lastScroll = currentScroll;
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobileToggle');
        const nav = document.getElementById('nav');
        
        if (mobileToggle && nav) {
            mobileToggle.addEventListener('click', () => {
                mobileToggle.classList.toggle('active');
                nav.classList.toggle('active');
            });
        }

        // Search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterMenuItems();
            });
        }

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                this.currentFilter = e.target.dataset.filter;
                this.filterMenuItems();
            });
        });

        // Close mobile menu when clicking nav links
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link')) {
                const mobileToggle = document.getElementById('mobileToggle');
                const nav = document.getElementById('nav');
                
                if (mobileToggle && nav) {
                    mobileToggle.classList.remove('active');
                    nav.classList.remove('active');
                }
            }
        });
    }

    // Load menu data
    async loadMenuData() {
        try {
            // In a real application, this would be an API call
            // For now, we'll use the external menu-data.js file
            if (typeof window.menuData !== 'undefined') {
                this.menuData = window.menuData;
                // Wait a bit for DOM to be ready, then render
                setTimeout(() => {
                    this.renderMenuSections();
                }, 100);
            }
        } catch (error) {
            console.error('Error loading menu data:', error);
        }
    }

    // Render menu sections dynamically
    renderMenuSections() {
        Object.keys(this.menuData).forEach(category => {
            this.renderMenuSection(category, this.menuData[category]);
        });
    }

    // Render individual menu section
    renderMenuSection(category, items) {
        const sectionElement = document.getElementById(category);
        if (!sectionElement) {
            console.log(`Section ${category} not found`);
            return;
        }

        const menuGrid = sectionElement.querySelector('.menu-grid');
        if (!menuGrid) {
            console.log(`Menu grid for ${category} not found`);
            return;
        }

        // Clear existing items (but not controls)
        const existingItems = menuGrid.querySelectorAll('.menu-item');
        existingItems.forEach(item => item.remove());

        // Add search and filter controls if they don't exist
        this.addMenuControls(sectionElement, category);

        // Render items
        items.forEach(item => {
            const menuItem = this.createMenuItem(item);
            menuGrid.appendChild(menuItem);
        });

        console.log(`Rendered ${items.length} items for ${category}`);
    }

    // Add search and filter controls to menu sections
    addMenuControls(sectionElement, category) {
        const menuContainer = sectionElement.querySelector('.menu-container');
        if (!menuContainer) return;

        // Check if controls already exist
        if (menuContainer.querySelector('.menu-controls')) return;

        const controlsHTML = `
            <div class="menu-controls">
                <div class="search-box">
                    <input type="text" class="search-input" placeholder="Buscar platos..." data-category="${category}">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all" data-category="${category}">Todos</button>
                    <button class="filter-btn" data-filter="nuevo" data-category="${category}">Nuevos</button>
                    <button class="filter-btn" data-filter="popular" data-category="${category}">Populares</button>
                    <button class="filter-btn" data-filter="vegano" data-category="${category}">Veganos</button>
                </div>
            </div>
        `;

        const sectionHeader = menuContainer.querySelector('.section-header');
        if (sectionHeader) {
            sectionHeader.insertAdjacentHTML('afterend', controlsHTML);
        } else {
            const backBtn = menuContainer.querySelector('.back-btn');
            if (backBtn) {
                backBtn.insertAdjacentHTML('afterend', controlsHTML);
            } else {
                menuContainer.insertAdjacentHTML('afterbegin', controlsHTML);
            }
        }

        // Setup event listeners for this specific section
        this.setupSearchAndFilterForSection(category);
    }

    // Setup search and filter event listeners for specific section
    setupSearchAndFilterForSection(category) {
        const section = document.getElementById(category);
        if (!section) return;

        const searchInput = section.querySelector('.search-input');
        const filterButtons = section.querySelectorAll('.filter-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                this.filterMenuItemsInSection(category, searchTerm, this.currentFilter);
            });
        }

        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from buttons in this section only
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const filter = e.target.dataset.filter;
                const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                this.filterMenuItemsInSection(category, searchTerm, filter);
            });
        });
    }

    // Legacy method - keeping for backwards compatibility
    setupSearchAndFilter() {
        // This is now handled by setupSearchAndFilterForSection
    }

    // Create menu item element - Diseño Premium
    createMenuItem(item) {
        const menuItemEl = document.createElement('div');
        menuItemEl.dataset.tags = item.tags ? item.tags.join(',') : '';
        menuItemEl.dataset.name = item.name.toLowerCase();
        menuItemEl.dataset.description = item.description.toLowerCase();

        // Detectar si el plato tiene imagen válida
        const hasImage = item.image && item.image !== '' && item.image !== null;

        // Agregar clase según si tiene imagen o no
        menuItemEl.className = hasImage ? 'menu-item fade-in' : 'menu-item fade-in no-image';

        // Create tags HTML - ahora se posicionan sobre la imagen
        const tagsHTML = item.tags && item.tags.length > 0 ? `
            <div class="menu-item-tags">
                ${item.tags.map(tag => `<span class="menu-tag ${tag}">${this.getTagLabel(tag)}</span>`).join('')}
            </div>
        ` : '';

        // Icono SVG elegante para platos sin imagen
        const noImageIcon = `
            <svg class="no-image-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M12 6v6l4 2"/>
            </svg>
        `;

        // Estructura diferente según si tiene imagen o no
        if (hasImage) {
            menuItemEl.innerHTML = `
                <div class="menu-item-image-wrapper">
                    <img src="${item.image}"
                         alt="${item.name}"
                         loading="lazy">
                    ${tagsHTML}
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-line"></div>
                    <h3 class="menu-item-name">${item.name}</h3>
                    <p class="menu-item-desc">${item.description}</p>
                    <div class="menu-item-footer">
                        <span class="menu-item-price">${item.price}</span>
                    </div>
                </div>
            `;
        } else {
            // Diseño elegante sin imagen
            menuItemEl.innerHTML = `
                <div class="menu-item-image-wrapper">
                    ${noImageIcon}
                    ${tagsHTML}
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-line"></div>
                    <h3 class="menu-item-name">${item.name}</h3>
                    <p class="menu-item-desc">${item.description}</p>
                    <div class="menu-item-footer">
                        <span class="menu-item-price">${item.price}</span>
                    </div>
                </div>
            `;
        }

        // Add click event listener for modal
        menuItemEl.addEventListener('click', () => {
            this.openDishModal(item);
        });

        return menuItemEl;
    }

    // Get tag label in Spanish
    getTagLabel(tag) {
        const labels = {
            'nuevo': 'Nuevo',
            'popular': 'Popular',
            'vegano': 'Vegano',
            'vegetariano': 'Vegetariano',
            'sin_gluten': 'Sin Gluten',
            'picante': 'Picante'
        };
        return labels[tag] || tag;
    }

    // Filter menu items in a specific section
    filterMenuItemsInSection(category, searchTerm, filter) {
        const section = document.getElementById(category);
        if (!section) return;

        const menuItems = section.querySelectorAll('.menu-item');
        let visibleCount = 0;
        
        menuItems.forEach(item => {
            const matchesSearch = searchTerm === '' || 
                                item.dataset.name.includes(searchTerm) ||
                                item.dataset.description.includes(searchTerm);
            
            const matchesFilter = filter === 'all' || 
                                item.dataset.tags.includes(filter);
            
            if (matchesSearch && matchesFilter) {
                item.classList.remove('hidden');
                item.classList.add('fade-in');
                visibleCount++;
            } else {
                item.classList.add('hidden');
                item.classList.remove('fade-in');
            }
        });

        // Show/hide no results message
        this.toggleNoResultsMessageInSection(section, visibleCount === 0);
    }

    // Legacy filter function - keeping for backwards compatibility
    filterMenuItems() {
        const currentSection = document.querySelector('.menu-section.active');
        if (!currentSection) return;
        
        const categoryId = currentSection.id;
        this.filterMenuItemsInSection(categoryId, this.searchTerm, this.currentFilter);
    }

    // Toggle no results message in specific section
    toggleNoResultsMessageInSection(section, showMessage) {
        let noResultsEl = section.querySelector('.no-results');
        
        if (showMessage) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.className = 'no-results';
                noResultsEl.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: var(--negro-texto);">
                        <h3 style="font-family: 'Playfair Display', serif; font-size: 2rem; margin-bottom: 15px; color: var(--azul-principal);">
                            No se encontraron resultados
                        </h3>
                        <p style="font-size: 1.1rem; opacity: 0.7;">
                            Intenta con otros términos de búsqueda o cambia los filtros.
                        </p>
                    </div>
                `;
                section.querySelector('.menu-grid').appendChild(noResultsEl);
            }
            noResultsEl.style.display = 'block';
        } else {
            if (noResultsEl) {
                noResultsEl.style.display = 'none';
            }
        }
    }

    // Legacy method - keeping for backwards compatibility
    toggleNoResultsMessage(section) {
        const visibleItems = section.querySelectorAll('.menu-item:not(.hidden)');
        this.toggleNoResultsMessageInSection(section, visibleItems.length === 0);
    }

    // Navigation functionality
    showSection(sectionId) {
        // Get all sections
        const allSections = document.querySelectorAll('.hero, .categories-section, .menu-section, .contact-section, .reservation-info-section, .instalaciones-section');

        // Hide all sections first
        allSections.forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // Special handling for hero section
        if (sectionId === 'hero') {
            const hero = document.querySelector('.hero');
            if (hero) {
                hero.style.display = 'flex';
                hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            // Try to find section by ID first
            let targetSection = document.getElementById(sectionId);

            // If not found, try with '-section' suffix
            if (!targetSection) {
                targetSection = document.getElementById(sectionId + '-section');
            }

            // If still not found, try as class
            if (!targetSection) {
                targetSection = document.querySelector('.' + sectionId + '-section');
            }

            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');

                // Smooth scroll with offset for header
                const headerHeight = document.getElementById('header')?.offsetHeight || 0;
                const targetPosition = targetSection.offsetTop - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Set the correct nav link as active
        const navLinkMap = {
            'hero': 0,
            'categories': 1,
            'entradas': 1,
            'mar': 1,
            'tierra': 1,
            'pasta': 1,
            'arroces': 1,
            'bebidas': 1,
            'instalaciones': 2,
            'reservation-info': 3,
            'contact': 4
        };

        const navIndex = navLinkMap[sectionId];
        if (navIndex !== undefined) {
            document.querySelectorAll('.nav-link')[navIndex]?.classList.add('active');
        }

        // Close mobile menu
        const mobileToggle = document.getElementById('mobileToggle');
        const nav = document.getElementById('nav');

        if (mobileToggle && nav) {
            mobileToggle.classList.remove('active');
            nav.classList.remove('active');
        }

        // Reset search and filters when changing sections
        this.resetFilters();

        // Store current section
        this.currentSection = sectionId;
    }

    // Check if section is a menu section
    isMenuSection(sectionId) {
        const menuSections = ['entradas', 'mar', 'tierra', 'pasta', 'arroces', 'bebidas'];
        return menuSections.includes(sectionId);
    }

    // Show specific menu section
    showMenuSection(category) {
        this.showSection(category);
    }

    // Show specific category (used when clicking category cards)
    showCategory(category) {
        // Simply delegate to showSection with the category ID
        // This ensures consistent navigation handling
        this.showSection(category);
    }

    // Reset filters for current section
    resetFilters() {
        const currentSection = document.querySelector('.menu-section.active');
        if (!currentSection) return;
        
        // Reset search input in current section
        const searchInput = currentSection.querySelector('.search-input');
        if (searchInput) searchInput.value = '';
        
        // Reset filter buttons in current section
        const filterButtons = currentSection.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });
        
        // Show all items in current section
        const menuItems = currentSection.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.remove('hidden');
            item.classList.add('fade-in');
        });
        
        // Hide no results message in current section
        const noResults = currentSection.querySelector('.no-results');
        if (noResults) noResults.style.display = 'none';
        
        // Reset global filters
        this.searchTerm = '';
        this.currentFilter = 'all';
    }

    // Setup intersection observer for animations
    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, observerOptions);
        
        // Observe elements when DOM is ready
        setTimeout(() => {
            document.querySelectorAll('.category-card, .menu-item').forEach(el => {
                observer.observe(el);
            });
        }, 100);
    }

    // Lazy load images
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Print menu functionality
    printMenu() {
        window.print();
    }

    // Share menu functionality
    shareMenu() {
        if (navigator.share) {
            navigator.share({
                title: 'Menú - Mar&Tierra Restaurant',
                text: 'Descubre nuestro exquisito menú donde el mar y la tierra se encuentran',
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                // You could show a toast notification here
                console.log('URL copied to clipboard');
            });
        }
    }

    // Update availability of menu items
    updateItemAvailability(itemId, available) {
        // This would typically update the backend
        // For now, just update the UI
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        if (item) {
            if (available) {
                item.classList.remove('unavailable');
            } else {
                item.classList.add('unavailable');
                // Add "Agotado" label
                const unavailableLabel = item.querySelector('.unavailable-label');
                if (!unavailableLabel) {
                    const label = document.createElement('span');
                    label.className = 'unavailable-label menu-tag';
                    label.textContent = 'Agotado';
                    label.style.background = '#ef4444';
                    label.style.color = 'white';
                    item.querySelector('.menu-item-tags')?.appendChild(label);
                }
            }
        }
    }

    // Modal functionality
    openDishModal(item) {
        const modal = document.getElementById('dishModal');
        const modalImage = document.getElementById('modalDishImage');
        const modalName = document.getElementById('modalDishName');
        const modalPrice = document.getElementById('modalDishPrice');
        const modalDescription = document.getElementById('modalDishDesc');
        const modalTags = document.getElementById('modalDishTags');
        
        if (!modal) return;
        
        // Populate modal content
        modalImage.src = item.image || 'images/placeholder.jpg';
        modalImage.alt = item.name;
        modalName.textContent = item.name;
        modalPrice.textContent = item.price;
        modalDescription.textContent = item.description;
        
        // Add tags if they exist
        if (item.tags && item.tags.length > 0) {
            modalTags.innerHTML = item.tags.map(tag => 
                `<span class="menu-tag ${tag}">${this.getTagLabel(tag)}</span>`
            ).join('');
        } else {
            modalTags.innerHTML = '';
        }
        
        // Show modal with animation
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    closeDishModal() {
        const modal = document.getElementById('dishModal');
        if (!modal) return;
        
        // Hide modal with animation
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Setup modal event listeners
    setupModalEventListeners() {
        // Close modal when clicking close button or its children
        document.addEventListener('click', (e) => {
            if (e.target.closest('.dish-modal-close')) {
                this.closeDishModal();
            }
        });

        // Close modal when clicking backdrop (but not the modal content)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('dish-modal-overlay')) {
                this.closeDishModal();
            }
        });

        // Close modal with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDishModal();
            }
        });
    }
}

// Global functions for backward compatibility
function showSection(sectionId) {
    window.menuApp?.showSection(sectionId);
}

function showMenuSection(category) {
    window.menuApp?.showMenuSection(category);
}

function closeDishModal() {
    window.menuApp?.closeDishModal();
}

// Reservation System Functions
function openReservationModal(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setMinDate();
        setupReservationEventListeners();
        calculateTotal(); // Initialize cost calculation
    }
}

function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function resetReservationForm() {
    const form = document.getElementById('reservationForm');
    const success = document.getElementById('reservationSuccess');
    const error = document.getElementById('reservationError');
    
    if (form) {
        form.style.display = 'block';
        form.reset();
        clearAllErrors();
    }
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
}

function setMinDate() {
    const dateInput = document.getElementById('resDate');
    if (dateInput) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
        
        // Set max date to 3 months from now
        const maxDate = new Date(today);
        maxDate.setMonth(maxDate.getMonth() + 3);
        dateInput.max = maxDate.toISOString().split('T')[0];
    }
}

function setupReservationEventListeners() {
    const form = document.getElementById('reservationForm');
    const modalClose = document.querySelector('.reservation-modal-close');
    const modal = document.getElementById('reservationModal');
    
    // Close button
    if (modalClose) {
        modalClose.onclick = () => closeReservationModal();
    }
    
    // Click outside to close
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeReservationModal();
            }
        };
    }
    
    // Form submission
    if (form && !form.hasAttribute('data-listeners-added')) {
        form.setAttribute('data-listeners-added', 'true');
        form.onsubmit = handleReservationSubmit;
    }
}

// Horarios de operación del restaurante por día de la semana
// 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
const RESTAURANT_HOURS = {
    0: { open: '11:30', close: '21:00', name: 'Domingo' },      // Domingo: 11:30 AM - 9:00 PM
    1: { open: '11:30', close: '22:00', name: 'Lunes' },        // Lunes: 11:30 AM - 10:00 PM
    2: { open: '11:30', close: '23:00', name: 'Martes' },       // Martes: 11:30 AM - 11:00 PM
    3: { open: '11:30', close: '23:00', name: 'Miércoles' },    // Miércoles: 11:30 AM - 11:00 PM
    4: { open: '11:30', close: '23:00', name: 'Jueves' },       // Jueves: 11:30 AM - 11:00 PM
    5: { open: '11:30', close: '23:59', name: 'Viernes' },      // Viernes: 11:30 AM - 12:00 AM
    6: { open: '11:30', close: '23:59', name: 'Sábado' }        // Sábado: 11:30 AM - 12:00 AM
};

// Capacidades de salones
const SALON_CAPACITIES = {
    'moon-terraza': { name: 'Moon Terraza', capacity: 30, description: 'Terraza al aire libre con vista panorámica' },
    'golden': { name: 'Salón Golden', capacity: 44, description: 'Salón elegante para eventos especiales', allowsShared: true },
    'arca': { name: 'Arca', capacity: 60, description: 'Espacio amplio para grupos grandes' },
    'barco': { name: 'Barco', capacity: 16, description: 'Área íntima con decoración náutica' },
    'chill-out': { name: 'Chill Out', capacity: 8, description: 'Zona relajada para pequeños grupos' }
};

// Estado de disponibilidad (se actualiza en tiempo real)
let currentAvailability = null;
let isCheckingAvailability = false;

// URL del Google Apps Script (usar la misma que para POST)
const AVAILABILITY_API_URL = 'https://script.google.com/macros/s/AKfycby82a2FsVV-kzhaGPt3RnwjCi29NL92DuhEttgU-Vrp_hzTvTKDxnI8lipnDUvT-58-/exec';

/**
 * Verifica la disponibilidad en tiempo real
 * Se llama cuando cambia salón, fecha, hora o número de personas
 */
async function checkAvailabilityRealTime() {
    const salon = document.getElementById('resSalon')?.value;
    const date = document.getElementById('resDate')?.value;
    const time = document.getElementById('resTime')?.value;
    const people = document.getElementById('resPeople')?.value;
    const availabilityStatus = document.getElementById('availabilityStatus');
    const submitBtn = document.querySelector('.btn-submit');

    // Si no hay todos los datos, limpiar estado
    if (!salon || !date || !time || !people) {
        if (availabilityStatus) {
            availabilityStatus.style.display = 'none';
        }
        currentAvailability = null;
        return;
    }

    // Evitar múltiples llamadas simultáneas
    if (isCheckingAvailability) return;
    isCheckingAvailability = true;

    // Mostrar estado de carga
    if (availabilityStatus) {
        availabilityStatus.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>Verificando disponibilidad...</span>
        `;
        availabilityStatus.className = 'availability-status checking';
        availabilityStatus.style.display = 'flex';
    }

    try {
        const url = `${AVAILABILITY_API_URL}?action=check-availability&salon=${encodeURIComponent(salon)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&people=${encodeURIComponent(people)}`;

        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });

        const data = await response.json();
        currentAvailability = data;

        if (availabilityStatus) {
            if (data.available) {
                // Disponible
                let message = `<i class="fas fa-check-circle"></i><div><strong>¡Disponible!</strong>`;

                if (data.remainingCapacity !== undefined && data.remainingCapacity > 0) {
                    message += `<br><small>Quedan ${data.remainingCapacity} lugares después de su reserva</small>`;
                }

                if (data.currentReservations > 0) {
                    message += `<br><small>${data.currentReservations} reserva(s) existente(s) en este horario</small>`;
                }

                message += `</div>`;
                availabilityStatus.innerHTML = message;
                availabilityStatus.className = 'availability-status available';

                if (submitBtn) submitBtn.disabled = false;
            } else {
                // No disponible
                let message = `<i class="fas fa-times-circle"></i><div><strong>No disponible</strong>`;
                message += `<br><small>${data.message || 'No hay disponibilidad para esta combinación'}</small>`;

                // Dar sugerencias según la razón
                if (data.reason === 'CAPACITY_EXCEEDED') {
                    message += `<br><small class="suggestion">Sugerencia: Seleccione un salón más grande o reduzca el número de personas</small>`;
                } else if (data.reason === 'INSUFFICIENT_CAPACITY') {
                    message += `<br><small class="suggestion">Sugerencia: Pruebe con otro horario o un salón más grande</small>`;
                } else if (data.reason === 'MAX_RESERVATIONS_REACHED' || data.reason === 'NO_SHARED_BOOKING') {
                    message += `<br><small class="suggestion">Sugerencia: Seleccione otro horario o salón</small>`;
                } else if (data.reason === 'EXCLUSIVE_BOOKING') {
                    message += `<br><small class="suggestion">Este salón está reservado de forma privada. Pruebe otro horario.</small>`;
                }

                message += `</div>`;
                availabilityStatus.innerHTML = message;
                availabilityStatus.className = 'availability-status unavailable';

                // No deshabilitar el botón, pero la validación lo bloqueará
            }
            availabilityStatus.style.display = 'flex';
        }

    } catch (error) {
        console.warn('Error verificando disponibilidad:', error);
        // En caso de error de red, permitir continuar (el backend validará)
        if (availabilityStatus) {
            availabilityStatus.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div><small>No se pudo verificar disponibilidad. Se validará al enviar.</small></div>
            `;
            availabilityStatus.className = 'availability-status warning';
            availabilityStatus.style.display = 'flex';
        }
        currentAvailability = null;
    } finally {
        isCheckingAvailability = false;
    }
}

/**
 * Debounce para evitar demasiadas llamadas a la API
 */
let availabilityTimeout = null;
function debouncedCheckAvailability() {
    if (availabilityTimeout) {
        clearTimeout(availabilityTimeout);
    }
    availabilityTimeout = setTimeout(checkAvailabilityRealTime, 500);
}

// Función para formatear hora en formato 12h AM/PM
function formatTimeToAMPM(hour, minutes) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Función para poblar las opciones de hora según el día seleccionado
function populateTimeOptions(selectedDate) {
    const timeSelect = document.getElementById('resTime');
    if (!timeSelect) return;

    // Limpiar opciones existentes
    timeSelect.innerHTML = '';

    if (!selectedDate) {
        timeSelect.innerHTML = '<option value="">Primero seleccione una fecha</option>';
        timeSelect.disabled = true;
        return;
    }

    const date = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const hours = RESTAURANT_HOURS[dayOfWeek];

    if (!hours) {
        timeSelect.innerHTML = '<option value="">No disponible este día</option>';
        timeSelect.disabled = true;
        return;
    }

    // Parsear horarios
    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour, closeMin] = hours.close.split(':').map(Number);

    // Convertir a minutos totales para comparación más precisa
    const openTimeMinutes = openHour * 60 + openMin;
    const closeTimeMinutes = closeHour * 60 + closeMin;

    // Última reserva 1 hora antes del cierre
    const lastReservationMinutes = closeTimeMinutes - 60;

    // Generar opciones cada 30 minutos
    timeSelect.innerHTML = '<option value="">Seleccione hora</option>';

    let currentMinutes = openTimeMinutes;

    while (currentMinutes <= lastReservationMinutes) {
        const currentHour = Math.floor(currentMinutes / 60);
        const currentMin = currentMinutes % 60;

        const value = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
        const label = formatTimeToAMPM(currentHour, currentMin);

        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        timeSelect.appendChild(option);

        // Incrementar 30 minutos
        currentMinutes += 30;
    }

    timeSelect.disabled = false;
}

// Función para actualizar información del salón seleccionado
function updateSalonInfo() {
    const salonSelect = document.getElementById('resSalon');
    const peopleSelect = document.getElementById('resPeople');
    const salonInfoDiv = document.getElementById('salonInfo');
    const goldenMsg = document.getElementById('goldenExclusiveMsg');
    const formGroup = salonSelect?.closest('.form-group');
    const errorMsg = formGroup?.querySelector('.error-message');

    if (!salonSelect || !salonInfoDiv) return;

    const selectedSalon = salonSelect.value;
    const selectedPeople = parseInt(peopleSelect?.value) || 0;

    // Limpiar errores previos
    if (formGroup) formGroup.classList.remove('error');
    if (errorMsg) errorMsg.classList.remove('show');

    // Ocultar mensaje Golden por defecto
    if (goldenMsg) goldenMsg.style.display = 'none';

    if (!selectedSalon) {
        salonInfoDiv.style.display = 'none';
        return;
    }

    const salonData = SALON_CAPACITIES[selectedSalon];
    if (!salonData) {
        salonInfoDiv.style.display = 'none';
        return;
    }

    // Mostrar información del salón
    salonInfoDiv.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${salonData.description} - Capacidad máxima: ${salonData.capacity} personas</span>
    `;
    salonInfoDiv.style.display = 'flex';

    // Mostrar mensaje especial para Golden
    if (selectedSalon === 'golden' && goldenMsg) {
        goldenMsg.style.display = 'block';
    }

    // Validar capacidad si hay personas seleccionadas
    if (selectedPeople > 0 && selectedPeople > salonData.capacity) {
        if (formGroup) formGroup.classList.add('error');
        if (errorMsg) {
            errorMsg.textContent = `El ${salonData.name} tiene capacidad máxima de ${salonData.capacity} personas`;
            errorMsg.classList.add('show');
        }
    }
}

// Función para validar capacidad cuando cambia el número de personas
function validateSalonCapacity() {
    const salonSelect = document.getElementById('resSalon');
    const peopleSelect = document.getElementById('resPeople');

    if (!salonSelect || !salonSelect.value) return;

    const selectedSalon = salonSelect.value;
    const selectedPeople = parseInt(peopleSelect?.value) || 0;
    const salonData = SALON_CAPACITIES[selectedSalon];

    if (!salonData) return;

    const formGroup = salonSelect.closest('.form-group');
    const errorMsg = formGroup?.querySelector('.error-message');

    if (selectedPeople > salonData.capacity) {
        if (formGroup) formGroup.classList.add('error');
        if (errorMsg) {
            errorMsg.textContent = `El ${salonData.name} tiene capacidad máxima de ${salonData.capacity} personas`;
            errorMsg.classList.add('show');
        }
    } else {
        if (formGroup) formGroup.classList.remove('error');
        if (errorMsg) errorMsg.classList.remove('show');
    }
}

// Inicializar el listener del campo de fecha cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    const dateField = document.getElementById('resDate');
    if (dateField) {
        // Establecer fecha mínima como hoy (usando fecha local, no UTC)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        dateField.setAttribute('min', todayStr);

        // Escuchar cambios en la fecha
        dateField.addEventListener('change', function() {
            populateTimeOptions(this.value);
            debouncedCheckAvailability();
        });
    }

    // Escuchar cambios en el número de personas para validar capacidad y disponibilidad
    const peopleField = document.getElementById('resPeople');
    if (peopleField) {
        peopleField.addEventListener('change', function() {
            validateSalonCapacity();
            debouncedCheckAvailability();
        });
    }

    // Escuchar cambios en la hora
    const timeField = document.getElementById('resTime');
    if (timeField) {
        timeField.addEventListener('change', debouncedCheckAvailability);
    }

    // Escuchar cambios en el salón (agregar verificación de disponibilidad)
    const salonField = document.getElementById('resSalon');
    if (salonField) {
        salonField.addEventListener('change', function() {
            updateSalonInfo();
            debouncedCheckAvailability();
        });
    }
});

function validateReservationForm() {
    let isValid = true;
    const requiredFields = ['resName', 'resPhone', 'resEmail', 'resPeople', 'resSalon', 'resDate', 'resTime', 'resType'];

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const formGroup = field?.closest('.form-group');
        const errorMsg = formGroup?.querySelector('.error-message');

        if (!field || !field.value.trim()) {
            if (formGroup) formGroup.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = 'Este campo es requerido';
                errorMsg.classList.add('show');
            }
            isValid = false;
        } else {
            if (formGroup) formGroup.classList.remove('error');
            if (errorMsg) errorMsg.classList.remove('show');
        }
    });

    // Validate email format
    const emailField = document.getElementById('resEmail');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            const formGroup = emailField.closest('.form-group');
            const errorMsg = formGroup?.querySelector('.error-message');
            if (formGroup) formGroup.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = 'Por favor ingrese un email válido';
                errorMsg.classList.add('show');
            }
            isValid = false;
        }
    }

    // Validate phone format
    const phoneField = document.getElementById('resPhone');
    if (phoneField && phoneField.value) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(phoneField.value) || phoneField.value.length < 7) {
            const formGroup = phoneField.closest('.form-group');
            const errorMsg = formGroup?.querySelector('.error-message');
            if (formGroup) formGroup.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = 'Por favor ingrese un teléfono válido';
                errorMsg.classList.add('show');
            }
            isValid = false;
        }
    }

    // Get date and time fields for validation
    const dateField = document.getElementById('resDate');
    const timeField = document.getElementById('resTime');

    // Validate date is in the future
    if (dateField && dateField.value) {
        const selectedDate = new Date(dateField.value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            const formGroup = dateField.closest('.form-group');
            const errorMsg = formGroup?.querySelector('.error-message');
            if (formGroup) formGroup.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = 'La fecha debe ser hoy o en el futuro';
                errorMsg.classList.add('show');
            }
            isValid = false;
        }

        // Validate reservation is at least 2 hours in advance if it's today
        if (timeField && timeField.value && selectedDate.getTime() === today.getTime()) {
            const [hours, minutes] = timeField.value.split(':').map(Number);
            const reservationTime = new Date();
            reservationTime.setHours(hours, minutes, 0, 0);

            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

            if (reservationTime < twoHoursFromNow) {
                const formGroup = timeField.closest('.form-group');
                const errorMsg = formGroup?.querySelector('.error-message');
                if (formGroup) formGroup.classList.add('error');
                if (errorMsg) {
                    errorMsg.textContent = 'Las reservas para hoy deben hacerse con al menos 2 horas de anticipación';
                    errorMsg.classList.add('show');
                }
                isValid = false;
            }
        }
    }

    // Validate time is within restaurant operating hours
    if (dateField && dateField.value && timeField && timeField.value) {
        const selectedDate = new Date(dateField.value + 'T00:00:00');
        const dayOfWeek = selectedDate.getDay();
        const hours = RESTAURANT_HOURS[dayOfWeek];

        if (hours) {
            const [selectedHour, selectedMin] = timeField.value.split(':').map(Number);
            const [openHour, openMin] = hours.open.split(':').map(Number);
            const [closeHour, closeMin] = hours.close.split(':').map(Number);

            const selectedTimeMinutes = selectedHour * 60 + selectedMin;
            const openTimeMinutes = openHour * 60 + openMin;
            const closeTimeMinutes = closeHour * 60 + closeMin;

            // La última reserva debe ser al menos 1 hora antes del cierre
            const lastReservationMinutes = closeTimeMinutes - 60;

            if (selectedTimeMinutes < openTimeMinutes || selectedTimeMinutes > lastReservationMinutes) {
                const formGroup = timeField.closest('.form-group');
                const errorMsg = formGroup?.querySelector('.error-message');
                if (formGroup) formGroup.classList.add('error');
                if (errorMsg) {
                    const lastResHour = Math.floor(lastReservationMinutes / 60);
                    const lastResMin = lastReservationMinutes % 60;
                    const lastResFormatted = lastResHour > 12 ? lastResHour - 12 : lastResHour;
                    const lastResAmPm = lastResHour >= 12 ? 'PM' : 'AM';

                    errorMsg.textContent = `${hours.name}: Reservas de 11:30 AM a ${lastResFormatted}:${lastResMin.toString().padStart(2, '0')} ${lastResAmPm}`;
                    errorMsg.classList.add('show');
                }
                isValid = false;
            }
        }
    }

    // Validar capacidad del salón
    const salonSelect = document.getElementById('resSalon');
    const peopleSelect = document.getElementById('resPeople');
    if (salonSelect && salonSelect.value && peopleSelect && peopleSelect.value) {
        const salonData = SALON_CAPACITIES[salonSelect.value];
        const selectedPeople = parseInt(peopleSelect.value);

        if (salonData && selectedPeople > salonData.capacity) {
            const formGroup = salonSelect.closest('.form-group');
            const errorMsg = formGroup?.querySelector('.error-message');
            if (formGroup) formGroup.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = `El ${salonData.name} tiene capacidad máxima de ${salonData.capacity} personas`;
                errorMsg.classList.add('show');
            }
            isValid = false;
        }
    }

    // Validar disponibilidad (si ya se verificó)
    if (currentAvailability && currentAvailability.available === false) {
        const availabilityStatus = document.getElementById('availabilityStatus');
        if (availabilityStatus) {
            availabilityStatus.classList.add('shake');
            setTimeout(() => availabilityStatus.classList.remove('shake'), 500);
        }

        alert(`No hay disponibilidad:\n\n${currentAvailability.message || 'El horario seleccionado no está disponible.'}\n\nPor favor seleccione otro horario o salón.`);
        isValid = false;
    }

    return isValid;
}

function clearAllErrors() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
    });
    document.querySelectorAll('.error-message').forEach(msg => {
        msg.classList.remove('show');
    });
}

async function handleReservationSubmit(event) {
    event.preventDefault();
    
    if (!validateReservationForm()) {
        return;
    }
    
    const submitBtn = document.querySelector('.btn-submit');
    const btnText = submitBtn?.querySelector('.btn-text');
    const btnLoading = submitBtn?.querySelector('.btn-loading');
    
    // Show loading state
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline-flex';
    
    // Get selected services
    const selectedServices = [];
    document.querySelectorAll('input[name="services"]:checked').forEach(checkbox => {
        selectedServices.push(checkbox.value);
    });
    
    // Calculate total deposit
    const totalDeposit = calculateTotalDeposit();
    
    // Prepare form data
    const salonValue = document.getElementById('resSalon').value;
    const salonName = SALON_CAPACITIES[salonValue]?.name || salonValue;

    const formData = {
        timestamp: new Date().toISOString(),
        name: document.getElementById('resName').value,
        phone: document.getElementById('resPhone').value,
        email: document.getElementById('resEmail').value,
        people: document.getElementById('resPeople').value,
        salon: salonName,
        salonId: salonValue,
        date: document.getElementById('resDate').value,
        time: document.getElementById('resTime').value,
        reservationType: document.getElementById('resType').value,
        decorationPlan: document.getElementById('resDecoration').value,
        additionalServices: selectedServices.join(', ') || 'Ninguno',
        totalDeposit: totalDeposit,
        comments: document.getElementById('resComments').value || 'Sin comentarios',
        status: 'Pendiente de pago',
        paymentStatus: 'Por verificar'
    };
    
    try {
        // IMPORTANT: Replace with your Google Apps Script Web App URL
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby82a2FsVV-kzhaGPt3RnwjCi29NL92DuhEttgU-Vrp_hzTvTKDxnI8lipnDUvT-58-/exec';
        
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            throw new Error('Por favor configure la URL de Google Apps Script');
        }
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        // Since we're using no-cors, we can't read the response
        // We'll assume success if no error was thrown
        showReservationSuccess();
        
    } catch (error) {
        console.error('Error al enviar reserva:', error);
        showReservationError(error.message);
    } finally {
        // Reset button state
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}

function showReservationSuccess() {
    const form = document.getElementById('reservationForm');
    const success = document.getElementById('reservationSuccess');
    
    if (form) form.style.display = 'none';
    if (success) success.style.display = 'block';
    
    // Reset form for next use
    setTimeout(() => {
        resetReservationForm();
    }, 5000);
}

function showReservationError(message) {
    const form = document.getElementById('reservationForm');
    const error = document.getElementById('reservationError');
    const errorMessage = document.getElementById('errorMessage');
    
    if (form) form.style.display = 'none';
    if (error) error.style.display = 'block';
    if (errorMessage) {
        errorMessage.textContent = message || 'Ocurrió un error al procesar su reserva. Por favor, intente nuevamente.';
    }
}

// New Reservation Calculation Functions
function updateReservationType() {
    const peopleSelect = document.getElementById('resPeople');
    const typeSelect = document.getElementById('resType');
    const alert = document.getElementById('reservationTypeAlert');
    const alertText = alert?.querySelector('.alert-text');

    if (!peopleSelect || !typeSelect) return;

    const numPeople = parseInt(peopleSelect.value) || 0;
    const isPeople20Plus = peopleSelect.value === '20+';

    // Auto-select tipo basado en número de personas según nuevas políticas
    if (numPeople >= 15 || isPeople20Plus) {
        typeSelect.value = 'especial';
        if (alert && alertText) {
            alertText.textContent = 'Para grupos de 15+ personas: Anticipo de $150,000 por persona (puede pagar 50%). El anticipo es consumible.';
            alert.style.display = 'block';
        }

        // Deshabilitar opción Free para grupos grandes
        const estandarOption = typeSelect.querySelector('option[value="estandar"]');
        if (estandarOption) {
            estandarOption.disabled = true;
            estandarOption.textContent = 'Reserva Free (no disponible para 15+ personas)';
        }

        // Deshabilitar opciones que no aplican para grupos grandes
        const decoracionOption = typeSelect.querySelector('option[value="decoracion"]');
        const serviciosOption = typeSelect.querySelector('option[value="servicios"]');
        const comboOption = typeSelect.querySelector('option[value="decoracion-servicios"]');
        if (decoracionOption) decoracionOption.disabled = true;
        if (serviciosOption) serviciosOption.disabled = true;
        if (comboOption) comboOption.disabled = true;
    } else {
        // Grupos pequeños pueden usar cualquier tipo de reserva
        const estandarOption = typeSelect.querySelector('option[value="estandar"]');
        if (estandarOption) {
            estandarOption.disabled = false;
            estandarOption.textContent = 'Reserva Free ($100,000 consumibles)';
        }

        // Habilitar todas las opciones para grupos pequeños
        const decoracionOption = typeSelect.querySelector('option[value="decoracion"]');
        const serviciosOption = typeSelect.querySelector('option[value="servicios"]');
        const comboOption = typeSelect.querySelector('option[value="decoracion-servicios"]');
        if (decoracionOption) decoracionOption.disabled = false;
        if (serviciosOption) serviciosOption.disabled = false;
        if (comboOption) comboOption.disabled = false;

        if (alert) {
            alert.style.display = 'none';
        }
    }

    // Actualizar opciones y visibilidad de secciones
    updateReservationOptions();
}

function updateReservationOptions() {
    const typeSelect = document.getElementById('resType');
    const peopleSelect = document.getElementById('resPeople');
    const alert = document.getElementById('reservationTypeAlert');
    const alertText = alert?.querySelector('.alert-text');
    const costSummary = document.getElementById('costSummary');

    // Nuevos elementos para secciones condicionales
    const decorationSection = document.getElementById('decorationSection');
    const servicesSection = document.getElementById('servicesSection');
    const reservationTypeInfo = document.getElementById('reservationTypeInfo');
    const reservationTypeDescription = document.getElementById('reservationTypeDescription');
    const optionsNotAvailable = document.getElementById('optionsNotAvailable');
    const optionsHintText = document.getElementById('optionsHintText');
    const decorationSelect = document.getElementById('resDecoration');
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]');

    if (!typeSelect) return;

    const numPeople = parseInt(peopleSelect?.value) || 0;
    const reservationType = typeSelect.value;

    // Resetear secciones
    if (decorationSection) decorationSection.style.display = 'none';
    if (servicesSection) servicesSection.style.display = 'none';
    if (reservationTypeInfo) reservationTypeInfo.style.display = 'none';
    if (optionsNotAvailable) optionsNotAvailable.style.display = 'none';

    // Limpiar selecciones previas cuando se cambia de tipo
    if (decorationSelect && !['decoracion', 'decoracion-servicios', 'especial'].includes(reservationType)) {
        decorationSelect.value = 'none';
    }
    if (!['servicios', 'decoracion-servicios', 'especial'].includes(reservationType)) {
        serviceCheckboxes.forEach(cb => cb.checked = false);
    }

    // Mostrar alertas y secciones según tipo de reserva
    if (alert && alertText) {
        switch(reservationType) {
            case 'estandar':
                alertText.textContent = 'Anticipo: $100,000 totalmente consumibles. NO reembolsable. Puede reprogramar en 10 días.';
                alert.style.display = 'block';
                // Mostrar hint sobre opciones adicionales
                if (optionsNotAvailable && optionsHintText) {
                    optionsHintText.innerHTML = '¿Desea agregar <strong>decoración</strong> o <strong>servicios especiales</strong>? Seleccione el tipo de reserva correspondiente arriba para ver las opciones disponibles.';
                    optionsNotAvailable.style.display = 'block';
                }
                break;

            case 'decoracion':
                alertText.textContent = 'El costo del plan de decoración reemplaza el anticipo estándar.';
                alert.style.display = 'block';
                // Mostrar sección de decoración
                if (decorationSection) {
                    decorationSection.style.display = 'block';
                }
                // Mostrar info
                if (reservationTypeInfo && reservationTypeDescription) {
                    reservationTypeDescription.innerHTML = 'Haga de su ocasión algo especial con nuestros planes de decoración. El valor del plan elegido <strong>reemplaza</strong> el anticipo de Reserva Free. Este monto <strong>NO es reembolsable ni consumible</strong>.';
                    reservationTypeInfo.style.display = 'block';
                }
                break;

            case 'servicios':
                alertText.textContent = 'El costo COMPLETO del servicio reemplaza el anticipo. NO reembolsable.';
                alert.style.display = 'block';
                // Mostrar sección de servicios
                if (servicesSection) {
                    servicesSection.style.display = 'block';
                }
                // Mostrar info
                if (reservationTypeInfo && reservationTypeDescription) {
                    reservationTypeDescription.innerHTML = 'Añada artistas y profesionales para hacer su velada inolvidable. El valor de los servicios <strong>reemplaza</strong> el anticipo de Reserva Free y requiere <strong>pago del 100% por adelantado</strong>. No es reembolsable.';
                    reservationTypeInfo.style.display = 'block';
                }
                break;

            case 'decoracion-servicios':
                alertText.textContent = 'Combine decoración y servicios especiales para una experiencia completa.';
                alert.style.display = 'block';
                // Mostrar ambas secciones
                if (decorationSection) {
                    decorationSection.style.display = 'block';
                }
                if (servicesSection) {
                    servicesSection.style.display = 'block';
                }
                // Mostrar info
                if (reservationTypeInfo && reservationTypeDescription) {
                    reservationTypeDescription.innerHTML = 'La combinación perfecta para ocasiones muy especiales. Elija su plan de decoración y agregue los servicios que desee. El total de ambos <strong>reemplaza</strong> el anticipo estándar. Los montos <strong>NO son reembolsables</strong>.';
                    reservationTypeInfo.style.display = 'block';
                }
                break;

            case 'especial':
                alertText.textContent = `Grupos 15+ personas. Anticipo: $150,000 por persona (consumible). Puede pagar 50% del anticipo.`;
                alert.style.display = 'block';
                // Mostrar ambas secciones como opcionales
                if (decorationSection) {
                    decorationSection.style.display = 'block';
                }
                if (servicesSection) {
                    servicesSection.style.display = 'block';
                }
                // Mostrar info
                if (reservationTypeInfo && reservationTypeDescription) {
                    reservationTypeDescription.innerHTML = 'Para grupos de <strong>15 o más personas</strong>. El anticipo de $150,000 por persona es <strong>consumible</strong>. Adicionalmente puede agregar decoración y/o servicios especiales (estos sí requieren pago adicional no reembolsable).';
                    reservationTypeInfo.style.display = 'block';
                }
                break;

            default:
                alert.style.display = 'none';
        }
    }

    calculateTotal();
}

function calculateTotal() {
    const typeSelect = document.getElementById('resType');
    const peopleSelect = document.getElementById('resPeople');
    const decorationSelect = document.getElementById('resDecoration');
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
    const costSummary = document.getElementById('costSummary');

    // Obtener número de personas
    let numberOfPeople = parseInt(peopleSelect?.value) || 0;
    if (peopleSelect?.value === '20+') {
        numberOfPeople = 20; // Usar 20 como mínimo para 20+
    }

    // Calculate services cost primero
    let servicesCost = 0;
    const servicePrices = {
        'saxofonista': 400000,
        'violinista': 400000,
        'fotografo': 480000,
        'dj': 600000
    };

    serviceCheckboxes.forEach(checkbox => {
        servicesCost += servicePrices[checkbox.value] || 0;
    });

    // Calculate decoration cost
    let decorationCost = 0;
    const decorationPrices = {
        'plata': 80000,
        'oro': 120000,
        'luxury': 100000,
        'combo-plata-luxury': 180000,
        'combo-oro-luxury': 220000
    };

    if (decorationSelect?.value && decorationSelect.value !== 'none') {
        decorationCost = decorationPrices[decorationSelect.value] || 0;
    }

    // Calcular anticipos según nuevas políticas
    let baseDeposit = 0;
    let isConsumiable = false;
    let showServicesApart = false;
    let total = 0;

    switch(typeSelect?.value) {
        case 'estandar':
            // Reserva Free: $100,000 consumibles (sin decoración ni servicios)
            baseDeposit = 100000;
            isConsumiable = true;
            total = baseDeposit;
            break;

        case 'decoracion':
            // El costo del plan reemplaza el anticipo - NO consumible
            baseDeposit = 0;
            total = decorationCost;
            break;

        case 'servicios':
            // El costo completo del servicio reemplaza el anticipo
            baseDeposit = 0;
            total = servicesCost;
            break;

        case 'decoracion-servicios':
            // Combinación de decoración + servicios
            baseDeposit = 0;
            total = decorationCost + servicesCost;
            break;

        case 'especial':
            // Grupos 15+: $150,000 por persona (puede ser 50%)
            const anticipoPorPersona = 150000;
            const porcentajeAnticipo = 0.5; // 50% opcional

            if (numberOfPeople >= 15) {
                baseDeposit = anticipoPorPersona * numberOfPeople * porcentajeAnticipo;
                isConsumiable = true;
                // Servicios y decoración se pagan completos aparte
                total = baseDeposit + servicesCost + decorationCost;
                showServicesApart = true;
            }
            break;

        default:
            baseDeposit = 100000;
            total = baseDeposit;
    }

    // Update display
    const baseDepositSpan = document.getElementById('baseDeposit');
    const baseDepositItem = document.getElementById('baseDepositItem');
    const decorationCostSpan = document.getElementById('decorationCost');
    const decorationCostItem = document.getElementById('decorationCostItem');
    const servicesCostSpan = document.getElementById('servicesCost');
    const servicesCostItem = document.getElementById('servicesCostItem');
    const totalDepositSpan = document.getElementById('totalDeposit');

    // Actualizar texto según tipo de reserva
    const currentType = typeSelect?.value;

    if (baseDepositItem) {
        const label = baseDepositItem.querySelector('span:first-child');
        if (label) {
            if (currentType === 'especial') {
                label.textContent = `Anticipo 50% (${numberOfPeople} personas - consumible):`;
            } else if (currentType === 'estandar') {
                label.textContent = 'Anticipo consumible:';
            } else if (currentType === 'decoracion') {
                label.textContent = 'Plan de decoración (no consumible):';
            } else if (currentType === 'servicios') {
                label.textContent = 'Servicios especiales (no reembolsable):';
            } else if (currentType === 'decoracion-servicios') {
                label.textContent = 'Decoración + Servicios (no reembolsable):';
            } else {
                label.textContent = 'Anticipo de reserva:';
            }
        }
        // Mostrar siempre que haya algún costo
        baseDepositItem.style.display = (baseDeposit > 0 || total > 0) ? 'flex' : 'none';
    }

    if (baseDepositSpan) {
        if (currentType === 'estandar') {
            baseDepositSpan.textContent = formatCurrency(baseDeposit);
        } else if (currentType === 'decoracion') {
            baseDepositSpan.textContent = formatCurrency(decorationCost);
        } else if (currentType === 'servicios') {
            baseDepositSpan.textContent = formatCurrency(servicesCost);
        } else if (currentType === 'decoracion-servicios') {
            // Mostrar el total combinado en el principal
            baseDepositSpan.textContent = formatCurrency(total);
        } else if (currentType === 'especial') {
            baseDepositSpan.textContent = formatCurrency(baseDeposit);
        } else {
            baseDepositSpan.textContent = formatCurrency(baseDeposit);
        }
    }

    // Mostrar decoración y servicios por separado en decoracion-servicios y especial
    if (decorationCostSpan && decorationCostItem) {
        if ((currentType === 'decoracion-servicios' || currentType === 'especial') && decorationCost > 0) {
            decorationCostSpan.textContent = formatCurrency(decorationCost);
            decorationCostItem.style.display = 'flex';
            // Actualizar label
            const decLabel = decorationCostItem.querySelector('span:first-child');
            if (decLabel) decLabel.textContent = 'Plan de decoración:';
        } else {
            decorationCostItem.style.display = 'none';
        }
    }

    if (servicesCostSpan && servicesCostItem) {
        if ((currentType === 'decoracion-servicios' || currentType === 'especial') && servicesCost > 0) {
            servicesCostSpan.textContent = formatCurrency(servicesCost);
            servicesCostItem.style.display = 'flex';
            // Actualizar label
            const svcLabel = servicesCostItem.querySelector('span:first-child');
            if (svcLabel) svcLabel.textContent = 'Servicios especiales:';
        } else {
            servicesCostItem.style.display = 'none';
        }
    }

    // Para decoracion-servicios, mostrar el desglose pero el total en el principal
    if (currentType === 'decoracion-servicios' && baseDepositItem) {
        const label = baseDepositItem.querySelector('span:first-child');
        if (label && decorationCost > 0 && servicesCost > 0) {
            label.textContent = 'Total Decoración + Servicios:';
        } else if (label && decorationCost > 0) {
            label.textContent = 'Plan de decoración (no consumible):';
        } else if (label && servicesCost > 0) {
            label.textContent = 'Servicios especiales (no reembolsable):';
        }
    }

    if (totalDepositSpan) totalDepositSpan.textContent = formatCurrency(total);

    // Mostrar/ocultar resumen según si hay costos
    if (costSummary) {
        costSummary.style.display = total > 0 ? 'block' : 'none';
    }
}

function calculateTotalDeposit() {
    const typeSelect = document.getElementById('resType');
    const peopleSelect = document.getElementById('resPeople');
    const decorationSelect = document.getElementById('resDecoration');
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');

    // Obtener número de personas
    let numberOfPeople = parseInt(peopleSelect?.value) || 0;
    if (peopleSelect?.value === '20+') {
        numberOfPeople = 20; // Usar 20 como mínimo para 20+
    }

    // Calculate services cost
    let servicesCost = 0;
    const servicePrices = {
        'saxofonista': 400000,
        'violinista': 400000,
        'fotografo': 480000,
        'dj': 600000
    };

    serviceCheckboxes.forEach(checkbox => {
        servicesCost += servicePrices[checkbox.value] || 0;
    });

    // Calculate decoration cost
    let decorationCost = 0;
    const decorationPrices = {
        'plata': 80000,
        'oro': 120000,
        'luxury': 100000,
        'combo-plata-luxury': 180000,
        'combo-oro-luxury': 220000
    };

    if (decorationSelect?.value && decorationSelect.value !== 'none') {
        decorationCost = decorationPrices[decorationSelect.value] || 0;
    }

    // Calcular total según nuevas políticas
    let total = 0;

    switch(typeSelect?.value) {
        case 'estandar':
            // Reserva estándar: $100,000 consumibles
            if (decorationCost > 0) {
                // Si hay decoración, esta reemplaza el anticipo
                total = decorationCost;
            } else if (servicesCost > 0) {
                // Si hay servicios, el costo completo reemplaza el anticipo
                total = servicesCost;
            } else {
                // Solo reserva estándar
                total = 100000;
            }
            break;

        case 'decoracion':
            // El costo del plan reemplaza el anticipo
            total = decorationCost + servicesCost;
            break;

        case 'servicios':
            // El costo completo del servicio reemplaza el anticipo
            total = servicesCost + decorationCost;
            break;

        case 'especial':
            // Grupos 15+: $150,000 por persona (50% opcional)
            if (numberOfPeople >= 15) {
                const anticipoPorPersona = 150000;
                const porcentajeAnticipo = 0.5; // 50%
                const baseDeposit = anticipoPorPersona * numberOfPeople * porcentajeAnticipo;
                total = baseDeposit + servicesCost + decorationCost;
            }
            break;

        default:
            total = 100000 + decorationCost + servicesCost;
    }

    return formatCurrency(total);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Reservation Detail Modal Functions
const reservationDetails = {
    normal: {
        title: 'Reserva Free',
        badge: 'Anticipo Consumible',
        price: '$100.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>La nueva Reserva Free de Mar&Tierra garantiza tu mesa con un anticipo totalmente consumible.
            Ideal para quienes buscan asegurar su experiencia gastronómica con la tranquilidad de una reserva confirmada.</p>
            <p>Este tipo de reserva está diseñada para brindar seguridad tanto al cliente como al restaurante,
            asegurando el mejor servicio posible.</p>
        `,
        features: [
            'Anticipo de $100.000 totalmente consumibles',
            'Mesa 100% garantizada y confirmada',
            'NO reembolsable en caso de no asistencia',
            'Puede reprogramar en los próximos 10 días',
            'Perfecto para grupos de 1 a 14 personas',
            'Mesa en el salón principal del restaurante',
            'Acceso al menú completo',
            'El anticipo se descuenta de su cuenta final'
        ],
        extra: `
            <h4>Política de Cancelación:</h4>
            <ul>
                <li>NO se realiza devolución del anticipo</li>
                <li>Puede reprogramar dentro de los 10 días siguientes</li>
                <li>Pasados los 10 días, se pierde el anticipo</li>
                <li>Notificar cambios con 48 horas de anticipación</li>
            </ul>
            <h4>Recomendado para:</h4>
            <ul>
                <li>Cenas importantes de negocios</li>
                <li>Celebraciones familiares</li>
                <li>Fechas especiales y aniversarios</li>
                <li>Reuniones con reserva confirmada</li>
            </ul>
        `
    },
    regular: {
        title: 'Reserva con Decoración',
        badge: 'Plan Especial',
        price: 'Según plan elegido',
        image: 'images/placeholder.jpg',
        description: `
            <p>Transforma tu experiencia con nuestros planes de decoración especial. El costo del plan elegido
            reemplaza completamente el anticipo de Reserva Free.</p>
            <p>IMPORTANTE: El pago del plan de decoración NO es reembolsable NI consumible. Este monto cubre
            exclusivamente los servicios de decoración seleccionados.</p>
        `,
        features: [
            'El costo del plan reemplaza el anticipo de Reserva Free',
            'Dinero NO reembolsable bajo ninguna circunstancia',
            'Dinero NO consumible en alimentos o bebidas',
            'Mesa garantizada con decoración incluida',
            'Plan Plata: $80.000 (globos + pastel)',
            'Plan Oro: $120.000 (vino + globos + pastel)',
            'Plan Luxury: $100.000 (rosas + pétalos)',
            'Combos disponibles hasta $220.000'
        ],
        extra: `
            <h4>Condiciones Especiales:</h4>
            <ul>
                <li>El pago cubre ÚNICAMENTE la decoración</li>
                <li>NO se descuenta de la cuenta de consumo</li>
                <li>NO es reembolsable por cancelación</li>
                <li>Los productos son preparados especialmente</li>
            </ul>
            <h4>Proceso de Reserva:</h4>
            <ul>
                <li>1. Seleccione su plan de decoración</li>
                <li>2. Realice el pago completo del plan</li>
                <li>3. Su reserva queda confirmada</li>
                <li>4. Disfrute de su celebración especial</li>
            </ul>
        `
    },
    gold: {
        title: 'Reserva Especial 15+ Personas',
        badge: 'Grupos Grandes',
        price: '$150.000 por persona',
        image: 'images/placeholder.jpg',
        description: `
            <p>Diseñado exclusivamente para grupos de 15 o más personas. Esta modalidad ofrece condiciones
            especiales con un anticipo mayor que garantiza la mejor experiencia para eventos grandes.</p>
            <p>El anticipo puede ser del 50% del valor por persona, siendo totalmente consumible. Si incluye
            servicios especiales, estos se pagan completos adicionalmente.</p>
        `,
        features: [
            'Exclusivo para grupos de 15+ personas',
            'Anticipo: $150.000 por persona (consumible)',
            'Opción de pagar solo 50% del anticipo',
            'El anticipo ES consumible en su cuenta',
            'Servicios especiales: pago 100% adicional',
            'Servicios NO son reembolsables',
            'Acceso al Salón Gold disponible',
            'Atención VIP con personal dedicado',
            'Coordinador de eventos asignado',
            'Posibilidad de menú personalizado'
        ],
        extra: `
            <h4>Cálculo del Anticipo:</h4>
            <ul>
                <li>Base: 50% de $150.000 por persona</li>
                <li>Ejemplo 20 personas: $1.500.000 de anticipo</li>
                <li>+ Costo completo de servicios especiales</li>
                <li>El anticipo se descuenta del consumo final</li>
                <li>Los servicios se pagan aparte y completos</li>
            </ul>
            <h4>Servicios Adicionales:</h4>
            <ul>
                <li>Saxofonista/Violinista: $400.000 (pago completo)</li>
                <li>Fotógrafo: $480.000 (pago completo)</li>
                <li>DJ: $600.000 (pago completo)</li>
                <li>Estos montos NO son consumibles</li>
            </ul>
            <h4>Ideal para:</h4>
            <ul>
                <li>Bodas y grandes celebraciones</li>
                <li>Eventos corporativos</li>
                <li>Quinceañeras y graduaciones</li>
                <li>Reuniones familiares extensas</li>
            </ul>
        `
    },
    servicios: {
        title: 'Reserva con Servicios Especiales',
        badge: 'Experiencia VIP',
        price: 'Según servicios elegidos',
        image: 'images/placeholder.jpg',
        description: `
            <p>Haga de su velada una experiencia única e inolvidable con nuestros servicios especiales.
            Artistas profesionales y servicios premium para crear momentos mágicos.</p>
            <p>IMPORTANTE: El costo de los servicios reemplaza el anticipo estándar y NO es reembolsable.
            Requiere pago del 100% por adelantado.</p>
        `,
        features: [
            'Saxofonista profesional: $400.000 (1 hora)',
            'Violinista profesional: $400.000 (1 hora)',
            'Fotógrafo profesional: $480.000 (2 horas)',
            'DJ profesional: $600.000 (3 horas)',
            'El costo reemplaza el anticipo de Reserva Free',
            'Pago 100% por adelantado requerido',
            'NO es reembolsable bajo ninguna circunstancia',
            'Coordinación directa con el artista'
        ],
        extra: `
            <h4>Nuestros Artistas:</h4>
            <ul>
                <li>Músicos profesionales con repertorio personalizable</li>
                <li>Fotógrafos con equipo profesional</li>
                <li>DJs con sistema de sonido incluido</li>
            </ul>
            <h4>Condiciones:</h4>
            <ul>
                <li>Reservar con mínimo 1 semana de anticipación</li>
                <li>Sujeto a disponibilidad del artista</li>
                <li>Puede combinar múltiples servicios</li>
                <li>El artista llega 30 minutos antes</li>
            </ul>
        `
    },
    'decoracion-servicios': {
        title: 'Decoración + Servicios Especiales',
        badge: 'Experiencia Completa',
        price: 'Según selección',
        image: 'images/placeholder.jpg',
        description: `
            <p>La combinación perfecta para ocasiones verdaderamente especiales. Una la elegancia de
            nuestros planes de decoración con la magia de nuestros artistas profesionales.</p>
            <p>IMPORTANTE: El total combinado de decoración y servicios reemplaza el anticipo estándar.
            Ninguno de los montos es reembolsable.</p>
        `,
        features: [
            'Acceso a todos los planes de decoración',
            'Acceso a todos los servicios especiales',
            'Combine según su presupuesto y deseos',
            'Decoración + Servicios = Total del anticipo',
            'NO reembolsable bajo ninguna circunstancia',
            'Pago completo por adelantado',
            'Coordinación integral del evento',
            'Experiencia personalizada garantizada'
        ],
        extra: `
            <h4>Ejemplos de Combinación:</h4>
            <ul>
                <li>Plan Plata + Saxofonista: $480.000</li>
                <li>Plan Oro + Violinista: $520.000</li>
                <li>Plan Luxury + Fotógrafo: $580.000</li>
                <li>Plan Oro + Saxofonista + Fotógrafo: $1.000.000</li>
            </ul>
            <h4>Beneficios:</h4>
            <ul>
                <li>Coordinación única para todo el evento</li>
                <li>Ambientación perfectamente sincronizada</li>
                <li>Un solo punto de contacto</li>
                <li>Experiencia completamente personalizada</li>
            </ul>
        `
    }
};

const decorationDetails = {
    plata: {
        title: 'Plan Plata',
        badge: 'Decoración Elegante',
        price: '$80.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>Una opción encantadora para añadir un toque festivo a tu celebración. 
            El Plan Plata combina elementos clásicos de decoración con detalles dulces 
            que harán de tu evento algo especial sin exceder tu presupuesto.</p>
        `,
        features: [
            '3 globos de helio premium en colores a elección',
            'Porción de pastel artesanal del día',
            'Tarjeta personalizada con mensaje',
            'Confeti dorado en la mesa',
            'Presentación especial del pastel',
            'Momento fotográfico con el equipo'
        ],
        extra: `
            <h4>Opciones de Personalización:</h4>
            <ul>
                <li>Colores de globos: Dorado, plateado, rose gold, o temáticos</li>
                <li>Sabores de pastel: Chocolate, vainilla, red velvet, tres leches</li>
                <li>Mensaje personalizado en la tarjeta</li>
            </ul>
            <h4>Incluye:</h4>
            <ul>
                <li>Montaje 30 minutos antes de la llegada</li>
                <li>Coordinación con el equipo de servicio</li>
                <li>Limpieza posterior del área</li>
            </ul>
        `
    },
    oro: {
        title: 'Plan Oro',
        badge: 'Celebración Premium',
        price: '$120.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>La combinación perfecta de elegancia y celebración. El Plan Oro eleva tu evento 
            con detalles premium que incluyen una selección de vino fino y elementos decorativos 
            que crean el ambiente perfecto para brindar por los momentos especiales.</p>
        `,
        features: [
            'Botella de vino premium 375ml (Tinto o blanco)',
            '3 globos de helio con diseño especial',
            'Porción de pastel gourmet',
            'Copas de cristal especiales',
            'Decoración dorada de mesa',
            'Canción especial a elección',
            'Sesión fotográfica con el sommelier'
        ],
        extra: `
            <h4>Selección de Vinos:</h4>
            <ul>
                <li>Tinto: Malbec Reserva, Cabernet Sauvignon</li>
                <li>Blanco: Chardonnay, Sauvignon Blanc</li>
                <li>Espumante: Prosecco italiano (upgrade +$20.000)</li>
            </ul>
            <h4>Beneficios Adicionales:</h4>
            <ul>
                <li>Maridaje recomendado por nuestro sommelier</li>
                <li>Opción de guardar el vino como recuerdo</li>
                <li>Certificado de la bodega del vino seleccionado</li>
            </ul>
            <h4>Momento Especial:</h4>
            <ul>
                <li>Presentación especial con bengalas (opcional)</li>
                <li>Brindis guiado por el sommelier</li>
                <li>Fotografía profesional del momento (digital)</li>
            </ul>
        `
    },
    luxury: {
        title: 'Plan Luxury',
        badge: 'Romance & Elegancia',
        price: '$100.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>La máxima expresión de romance y sofisticación. El Plan Luxury transforma tu mesa 
            en un jardín de ensueño con flores naturales premium y una ambientación que evoca 
            los restaurantes más exclusivos del mundo.</p>
        `,
        features: [
            'Jarrón con 12 rosas naturales premium',
            'Pétalos de rosa esparcidos en la mesa',
            'Velas aromáticas de soya',
            'Camino de mesa en seda',
            'Servilletas de lino con anillo dorado',
            'Follaje verde decorativo',
            'Carta de amor/dedicatoria caligráfica'
        ],
        extra: `
            <h4>Opciones de Flores:</h4>
            <ul>
                <li>Rosas: Rojas, blancas, rosadas, o mix</li>
                <li>Flores alternativas: Tulipanes, orquídeas (+$30.000)</li>
                <li>Arreglo preservado para llevar a casa</li>
            </ul>
            <h4>Ambientación Incluida:</h4>
            <ul>
                <li>Iluminación romántica con velas LED</li>
                <li>Playlist romántica personalizada</li>
                <li>Aroma signature del restaurante</li>
                <li>Mesa en ubicación especial (terraza o ventana)</li>
            </ul>
            <h4>Servicios Complementarios:</h4>
            <ul>
                <li>Fotografía profesional de la propuesta</li>
                <li>Video del momento especial</li>
                <li>Caja de regalo con pétalos preservados</li>
            </ul>
        `
    }
};

function showReservationDetail(type) {
    const detail = reservationDetails[type];
    if (!detail) return;
    
    showDetailModal(detail);
}

function showDecorationDetail(type) {
    const detail = decorationDetails[type];
    if (!detail) return;
    
    showDetailModal(detail);
}

function showDetailModal(detail) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    
    // Populate modal content
    document.getElementById('detailImage').src = detail.image;
    document.getElementById('detailImage').alt = detail.title;
    document.getElementById('detailBadge').textContent = detail.badge;
    document.getElementById('detailTitle').textContent = detail.title;
    document.getElementById('detailPrice').textContent = detail.price;
    document.getElementById('detailDescription').innerHTML = detail.description;
    
    // Populate features
    const featuresHtml = `
        <h3>Características Destacadas:</h3>
        <ul class="detail-features-list">
            ${detail.features.map(feature => `<li>${feature}</li>`).join('')}
        </ul>
    `;
    document.getElementById('detailFeatures').innerHTML = featuresHtml;
    
    // Populate extra info
    document.getElementById('detailExtra').innerHTML = detail.extra;
    
    // Show modal
    modal.classList.add('active');
    // No bloquear el scroll del body para permitir scroll en el modal
    document.body.classList.add('modal-open');
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function openReservationModalFromDetail() {
    closeDetailModal();
    setTimeout(() => {
        openReservationModal(null);
    }, 300);
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDetailModal();
    }
});

// Close modal on click outside
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeDetailModal();
            }
        });
    }
});

// ============================================
// FUNCIONALIDAD DEL CARRUSEL PREMIUM
// ============================================

let currentSlide = 0;
const slides = [];

// Función para inicializar el carrusel con imágenes específicas
function initializeCarousel(images) {
    const carousel = document.getElementById('detailCarousel');
    if (!carousel) return;

    // Limpiar carrusel actual
    carousel.innerHTML = '';

    // Agregar imágenes al carrusel
    images.forEach((imgSrc, index) => {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `Vista ${index + 1}`;
        img.className = index === 0 ? 'carousel-image active' : 'carousel-image';
        carousel.appendChild(img);
    });

    // Actualizar indicadores
    const indicatorsContainer = document.querySelector('.carousel-indicators');
    if (indicatorsContainer) {
        indicatorsContainer.innerHTML = '';
        images.forEach((_, index) => {
            const indicator = document.createElement('span');
            indicator.className = index === 0 ? 'indicator active' : 'indicator';
            indicator.onclick = () => goToSlide(index);
            indicatorsContainer.appendChild(indicator);
        });
    }

    currentSlide = 0;
}

// Cambiar de slide
function changeSlide(direction) {
    const images = document.querySelectorAll('.carousel-image');
    const indicators = document.querySelectorAll('.indicator');

    if (images.length === 0) return;

    // Ocultar slide actual
    images[currentSlide].classList.remove('active');
    indicators[currentSlide]?.classList.remove('active');

    // Calcular siguiente slide
    currentSlide += direction;
    if (currentSlide >= images.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = images.length - 1;

    // Mostrar nuevo slide
    images[currentSlide].classList.add('active');
    indicators[currentSlide]?.classList.add('active');
}

// Ir a slide específico
function goToSlide(index) {
    const images = document.querySelectorAll('.carousel-image');
    const indicators = document.querySelectorAll('.indicator');

    if (index >= 0 && index < images.length) {
        // Ocultar slide actual
        images[currentSlide]?.classList.remove('active');
        indicators[currentSlide]?.classList.remove('active');

        // Mostrar slide solicitado
        currentSlide = index;
        images[currentSlide]?.classList.add('active');
        indicators[currentSlide]?.classList.add('active');
    }
}

// Auto-play del carrusel
let carouselInterval;

function startCarouselAutoplay() {
    stopCarouselAutoplay();
    carouselInterval = setInterval(() => {
        changeSlide(1);
    }, 4000); // Cambiar cada 4 segundos
}

function stopCarouselAutoplay() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
}

// Imágenes para cada tipo de plan/reserva
const carouselImages = {
    plata: [
        'https://source.unsplash.com/800x600/?balloons,party',
        'https://source.unsplash.com/800x600/?cake,dessert',
        'https://source.unsplash.com/800x600/?celebration,event',
        'https://source.unsplash.com/800x600/?restaurant,dining'
    ],
    oro: [
        'https://source.unsplash.com/800x600/?wine,glass',
        'https://source.unsplash.com/800x600/?champagne,celebration',
        'https://source.unsplash.com/800x600/?gourmet,cake',
        'https://source.unsplash.com/800x600/?luxury,dining'
    ],
    luxury: [
        'https://source.unsplash.com/800x600/?roses,flowers',
        'https://source.unsplash.com/800x600/?romantic,dinner',
        'https://source.unsplash.com/800x600/?luxury,decoration',
        'https://source.unsplash.com/800x600/?candles,ambiance'
    ],
    normal: [
        'https://source.unsplash.com/800x600/?restaurant,interior',
        'https://source.unsplash.com/800x600/?dining,table',
        'https://source.unsplash.com/800x600/?food,gourmet',
        'https://source.unsplash.com/800x600/?chef,kitchen'
    ],
    regular: [
        'https://source.unsplash.com/800x600/?restaurant,elegant',
        'https://source.unsplash.com/800x600/?decoration,table',
        'https://source.unsplash.com/800x600/?wine,dining',
        'https://source.unsplash.com/800x600/?celebration,party'
    ],
    gold: [
        'https://source.unsplash.com/800x600/?vip,lounge',
        'https://source.unsplash.com/800x600/?luxury,restaurant',
        'https://source.unsplash.com/800x600/?exclusive,dining',
        'https://source.unsplash.com/800x600/?premium,service'
    ]
};

// Actualizar función showDetailModal para incluir carrusel
const originalShowDetailModal = window.showDetailModal || function() {};

window.showDetailModal = function(detail) {
    originalShowDetailModal(detail);

    // Inicializar carrusel con imágenes según el tipo
    const type = detail.type || 'normal';
    const images = carouselImages[type] || carouselImages.normal;

    setTimeout(() => {
        initializeCarousel(images);
        startCarouselAutoplay();
    }, 100);
};

// Actualizar función showDecorationDetail
const originalShowDecorationDetail = window.showDecorationDetail || function() {};

window.showDecorationDetail = function(type) {
    const detail = decorationDetails[type];
    if (!detail) return;

    showDetailModal({...detail, type: type});
};

// Actualizar función showReservationDetail
const originalShowReservationDetail = window.showReservationDetail || function() {};

window.showReservationDetail = function(type) {
    const detail = reservationDetails[type];
    if (!detail) return;

    showDetailModal({...detail, type: type});
};

// Detener autoplay cuando se cierra el modal
const originalCloseDetailModal = window.closeDetailModal || function() {};

window.closeDetailModal = function() {
    stopCarouselAutoplay();
    originalCloseDetailModal();
};

// Initialize app
window.menuApp = new MenuApp();