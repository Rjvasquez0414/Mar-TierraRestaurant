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

    // Create menu item element
    createMenuItem(item) {
        const menuItemEl = document.createElement('div');
        menuItemEl.className = 'menu-item fade-in';
        menuItemEl.dataset.tags = item.tags ? item.tags.join(',') : '';
        menuItemEl.dataset.name = item.name.toLowerCase();
        menuItemEl.dataset.description = item.description.toLowerCase();

        // Create tags HTML
        const tagsHTML = item.tags ? item.tags.map(tag => 
            `<span class="menu-tag ${tag}">${this.getTagLabel(tag)}</span>`
        ).join('') : '';

        menuItemEl.innerHTML = `
            <div class="menu-item-image">
                <img src="${item.image || 'images/placeholder.jpg'}" 
                     alt="${item.name}" 
                     loading="lazy"
                     onerror="this.src='images/placeholder.jpg'">
            </div>
            <div class="menu-item-content">
                <div class="menu-item-header">
                    <h3 class="menu-item-name">${item.name}</h3>
                    <span class="menu-item-price">${item.price}</span>
                </div>
                <p class="menu-item-desc">${item.description}</p>
                ${tagsHTML ? `<div class="menu-item-tags">${tagsHTML}</div>` : ''}
            </div>
        `;

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
        // Hide all sections - incluye reservation-info
        document.querySelectorAll('.hero, .categories-section, .menu-section, .contact-section, .reservation-info-section').forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                if (sectionId === 'hero') {
                    section.style.display = 'flex';
                } else {
                    section.style.display = 'block';
                    section.classList.add('active');
                }
            } else if (section.id === 'hero' && sectionId !== 'hero') {
                section.style.display = 'none';
            } else {
                section.style.display = 'none';
            }
        });
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        if (sectionId === 'hero') {
            document.querySelectorAll('.nav-link')[0]?.classList.add('active');
        } else if (sectionId === 'categories' || this.isMenuSection(sectionId)) {
            document.querySelectorAll('.nav-link')[1]?.classList.add('active');
        } else if (sectionId === 'reservation-info') {
            document.querySelectorAll('.nav-link')[2]?.classList.add('active');
        } else if (sectionId === 'contact') {
            document.querySelectorAll('.nav-link')[3]?.classList.add('active');
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
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
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

function validateReservationForm() {
    let isValid = true;
    const requiredFields = ['resName', 'resPhone', 'resEmail', 'resPeople', 'resDate', 'resTime', 'resType'];
    
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
    const formData = {
        timestamp: new Date().toISOString(),
        name: document.getElementById('resName').value,
        phone: document.getElementById('resPhone').value,
        email: document.getElementById('resEmail').value,
        people: document.getElementById('resPeople').value,
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
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwha2RPjZ2XspOZkL-WSlaw0WGbpe4Ul2DHBdq0hh_gUXmWpeKyMlEmZoOFSiLZS7vb/exec';
        
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
    
    // Auto-select tipo basado en número de personas
    if (numPeople >= 15) {
        typeSelect.value = 'especial';
        if (alert && alertText) {
            alertText.textContent = 'Para grupos de 15+ personas se requiere Reserva Especial con anticipo';
            alert.style.display = 'block';
        }
    } else if (numPeople > 6) {
        // Sugerir reserva regular para grupos medianos
        if (typeSelect.value === 'normal') {
            typeSelect.value = 'regular';
            if (alert && alertText) {
                alertText.textContent = 'Recomendamos Reserva Regular para grupos de 7+ personas';
                alert.style.display = 'block';
            }
        }
    } else {
        // Grupos pequeños pueden usar reserva normal
        if (alert) {
            alert.style.display = 'none';
        }
    }
    
    calculateTotal();
}

function updateReservationOptions() {
    const typeSelect = document.getElementById('resType');
    const alert = document.getElementById('reservationTypeAlert');
    const alertText = alert?.querySelector('.alert-text');
    const costSummary = document.getElementById('costSummary');
    
    if (!typeSelect) return;
    
    // Mostrar/ocultar resumen de costos según tipo
    if (typeSelect.value === 'normal') {
        // Sin anticipo para reserva normal
        if (costSummary) costSummary.style.display = 'none';
        if (alert && alertText) {
            alertText.textContent = 'Reserva sin anticipo - Sujeta a disponibilidad';
            alert.style.display = 'block';
        }
    } else {
        // Mostrar costos para otros tipos
        if (costSummary) costSummary.style.display = 'block';
        
        if (typeSelect.value === 'salon-gold' && alert && alertText) {
            alertText.textContent = 'Salón Gold: Experiencia exclusiva con anticipo de $100.000';
            alert.style.display = 'block';
        } else if (typeSelect.value === 'regular' && alert && alertText) {
            alertText.textContent = 'Reserva con anticipo de $100.000 - Mesa garantizada';
            alert.style.display = 'block';
        } else if (alert) {
            alert.style.display = 'none';
        }
    }
    
    calculateTotal();
}

function calculateTotal() {
    const typeSelect = document.getElementById('resType');
    const decorationSelect = document.getElementById('resDecoration');
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
    const costSummary = document.getElementById('costSummary');
    
    // Base deposit fijo según tipo de reserva
    let baseDeposit = 0;
    if (typeSelect?.value && typeSelect.value !== 'normal') {
        baseDeposit = 100000; // Anticipo fijo de $100.000
    }
    
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
    
    // Update display
    const baseDepositSpan = document.getElementById('baseDeposit');
    const baseDepositItem = document.getElementById('baseDepositItem');
    const decorationCostSpan = document.getElementById('decorationCost');
    const decorationCostItem = document.getElementById('decorationCostItem');
    const servicesCostSpan = document.getElementById('servicesCost');
    const servicesCostItem = document.getElementById('servicesCostItem');
    const totalDepositSpan = document.getElementById('totalDeposit');
    
    // Mostrar/ocultar anticipo base
    if (baseDepositItem) {
        baseDepositItem.style.display = baseDeposit > 0 ? 'flex' : 'none';
    }
    if (baseDepositSpan) {
        baseDepositSpan.textContent = baseDeposit > 0 ? formatCurrency(baseDeposit) : '$0';
    }
    
    if (decorationCostSpan && decorationCostItem) {
        decorationCostSpan.textContent = formatCurrency(decorationCost);
        decorationCostItem.style.display = decorationCost > 0 ? 'flex' : 'none';
    }
    
    if (servicesCostSpan && servicesCostItem) {
        servicesCostSpan.textContent = formatCurrency(servicesCost);
        servicesCostItem.style.display = servicesCost > 0 ? 'flex' : 'none';
    }
    
    const total = baseDeposit + decorationCost + servicesCost;
    if (totalDepositSpan) totalDepositSpan.textContent = formatCurrency(total);
    
    // Mostrar/ocultar resumen según si hay costos
    if (costSummary && typeSelect?.value !== 'normal') {
        costSummary.style.display = total > 0 ? 'block' : 'none';
    }
}

function calculateTotalDeposit() {
    const typeSelect = document.getElementById('resType');
    const decorationSelect = document.getElementById('resDecoration');
    const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
    
    // Base deposit fijo
    let baseDeposit = 0;
    if (typeSelect?.value && typeSelect.value !== 'normal') {
        baseDeposit = 100000;
    }
    
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
    
    return formatCurrency(baseDeposit + decorationCost + servicesCost);
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
        title: 'Reserva Normal',
        badge: 'Sin Anticipo',
        price: 'Gratis',
        image: 'images/placeholder.jpg',
        description: `
            <p>La opción perfecta para quienes buscan disfrutar de una experiencia gastronómica sin complicaciones. 
            Ideal para almuerzos de negocios, cenas casuales o encuentros improvisados con amigos y familia.</p>
            <p>Este tipo de reserva está diseñada para grupos pequeños que valoran la flexibilidad y la simplicidad 
            en su experiencia culinaria.</p>
        `,
        features: [
            '✓ Sin costo de anticipo - Reserva gratuita',
            '✓ Confirmación inmediata vía email',
            '✓ Perfecto para grupos de 1 a 6 personas',
            '✓ Mesa en el salón principal del restaurante',
            '✓ Acceso al menú completo',
            '✓ Servicio estándar de alta calidad',
            '✓ Cancelación sin penalización'
        ],
        extra: `
            <h4>Condiciones:</h4>
            <ul>
                <li>Sujeto a disponibilidad del momento</li>
                <li>Tiempo de espera máximo: 15 minutos</li>
                <li>En temporada alta puede haber lista de espera</li>
                <li>Se recomienda llegar puntual</li>
            </ul>
            <h4>Recomendado para:</h4>
            <ul>
                <li>Almuerzos ejecutivos</li>
                <li>Cenas románticas</li>
                <li>Encuentros familiares pequeños</li>
                <li>Reuniones casuales</li>
            </ul>
        `
    },
    regular: {
        title: 'Reserva Regular',
        badge: 'Con Anticipo',
        price: '$100.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>La elección ideal para celebraciones especiales y eventos importantes. Con esta reserva, 
            garantizas tu mesa y recibes un servicio prioritario que hará de tu experiencia algo memorable.</p>
            <p>El anticipo asegura que todo esté perfectamente preparado para tu llegada, con atención 
            personalizada desde el momento de tu reserva.</p>
        `,
        features: [
            '✓ Mesa 100% garantizada',
            '✓ Anticipo descontable de la cuenta final',
            '✓ Ubicación preferencial en el restaurante',
            '✓ Atención prioritaria del personal',
            '✓ Posibilidad de solicitudes especiales',
            '✓ Decoración básica incluida para celebraciones',
            '✓ Welcome drink de cortesía',
            '✓ Ideal para grupos de 7 a 14 personas'
        ],
        extra: `
            <h4>Beneficios Exclusivos:</h4>
            <ul>
                <li>Carta de vinos con descuento del 10%</li>
                <li>Postre de cortesía en cumpleaños</li>
                <li>Opción de pre-ordenar para agilizar servicio</li>
                <li>Asesoría del chef para menú especial</li>
            </ul>
            <h4>Proceso de Reserva:</h4>
            <ul>
                <li>1. Complete el formulario de reserva</li>
                <li>2. Realice el pago del anticipo ($100.000)</li>
                <li>3. Reciba confirmación en 24 horas</li>
                <li>4. Disfrute de su experiencia gastronómica</li>
            </ul>
        `
    },
    gold: {
        title: 'Salón Gold Exclusivo',
        badge: 'VIP Experience',
        price: '$100.000 COP',
        image: 'images/placeholder.jpg',
        description: `
            <p>La máxima expresión de elegancia y exclusividad en Mar&Tierra. El Salón Gold ofrece 
            un ambiente privado y sofisticado para eventos corporativos, celebraciones importantes 
            y reuniones que requieren el más alto nivel de servicio.</p>
            <p>Con capacidad para grupos grandes y decoración de lujo, este espacio transforma 
            cualquier evento en una experiencia inolvidable.</p>
        `,
        features: [
            '★ Salón privado exclusivo con ambiente VIP',
            '★ Capacidad para 15 a 50 personas',
            '★ Menú personalizable con el chef ejecutivo',
            '★ Servicio de meseros dedicados',
            '★ Decoración premium incluida',
            '★ Sistema de sonido privado',
            '★ Pantalla para presentaciones',
            '★ Estacionamiento preferencial',
            '★ Coctelería premium de bienvenida',
            '★ Coordinador de eventos dedicado'
        ],
        extra: `
            <h4>Servicios Incluidos:</h4>
            <ul>
                <li>Montaje personalizado según el evento</li>
                <li>Menú degustación previa (para el organizador)</li>
                <li>Flores naturales y centros de mesa</li>
                <li>Iluminación ambiental ajustable</li>
                <li>Área de recepción con coctelería</li>
            </ul>
            <h4>Ideal para:</h4>
            <ul>
                <li>Bodas y aniversarios</li>
                <li>Cenas de gala corporativas</li>
                <li>Lanzamientos de producto</li>
                <li>Celebraciones de quinceañeras</li>
                <li>Reuniones de directorio</li>
            </ul>
            <h4>Horarios Disponibles:</h4>
            <ul>
                <li>Almuerzo: 12:00 PM - 4:00 PM</li>
                <li>Cena: 6:00 PM - 11:00 PM</li>
                <li>Eventos especiales: Horario flexible</li>
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
            '🎈 3 globos de helio premium en colores a elección',
            '🍰 Porción de pastel artesanal del día',
            '🎨 Tarjeta personalizada con mensaje',
            '✨ Confeti dorado en la mesa',
            '🎁 Presentación especial del pastel',
            '📸 Momento fotográfico con el equipo'
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
            '🍷 Botella de vino premium 375ml (Tinto o blanco)',
            '🎈 3 globos de helio con diseño especial',
            '🍰 Porción de pastel gourmet',
            '🥂 Copas de cristal especiales',
            '💫 Decoración dorada de mesa',
            '🎵 Canción especial a elección',
            '📸 Sesión fotográfica con el sommelier'
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
            '🌹 Jarrón con 12 rosas naturales premium',
            '💐 Pétalos de rosa esparcidos en la mesa',
            '🕯️ Velas aromáticas de soya',
            '🎨 Camino de mesa en seda',
            '💎 Servilletas de lino con anillo dorado',
            '🌿 Follaje verde decorativo',
            '✉️ Carta de amor/dedicatoria caligráfica'
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
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
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

// Initialize app
window.menuApp = new MenuApp();