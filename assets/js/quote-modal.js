/**
 * ASC Pest Control - Quote Request Modal
 * Industrial & Commercial Services Quote Modal with Leaflet Map Integration
 */

class QuoteModal {
  constructor() {
    this.map = null;
    this.marker = null;
    this.selectedLat = null;
    this.selectedLng = null;
    this.selectedServices = new Set();
    this.serviceType = 'commercial'; // default
    this.currentStep = 1;
    this.init();
  }

  init() {
    this.createOverlay();
    this.createModal();
    this.attachEventListeners();
    this.initializeMap();
  }

  createOverlay() {
    const overlayHTML = `
      <div id="quoteOverlay" class="quote-overlay">
        <div class="quote-overlay-container">
          <div class="quote-overlay-content">
            <h2>Request a Quote or Book an Inspection</h2>
            <p>For commercial and industrial facilities — tell us your needs and location.</p>
            <button id="quoteOverlayBtn" class="btn btn-overlay">Request a Quote</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', overlayHTML);
  }

  createModal() {
    const modalHTML = `
      <div id="quoteModal" class="quote-modal" style="display: none;">
        <div class="quote-modal-overlay"></div>
        <div class="quote-modal-content">
          <div class="quote-modal-header">
            <h2>Request a Quote - Industrial & Commercial Services</h2>
            <button class="quote-modal-close" aria-label="Close">&times;</button>
          </div>
          
          <form id="quoteForm" class="quote-form">
            <!-- Step 1: Service Type Selection -->
            <div class="form-section" data-step="1">
              <h3>Service Type *</h3>
              <div class="service-type-toggle">
                <label class="toggle-option">
                  <input type="radio" name="serviceType" value="commercial" checked>
                  <span class="toggle-label">Commercial</span>
                </label>
                <label class="toggle-option">
                  <input type="radio" name="serviceType" value="industrial">
                  <span class="toggle-label">Industrial</span>
                </label>
              </div>
            </div>

            <!-- Step 2: Organization Details -->
            <div class="form-section" data-step="2" style="display: none;">
              <h3>Your Organization Details *</h3>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="companyName">Company Name *</label>
                  <input type="text" id="companyName" name="companyName" required placeholder="Enter company name">
                </div>
                <div class="form-group">
                  <label for="contactFirstName">First Name *</label>
                  <input type="text" id="contactFirstName" name="contactFirstName" required placeholder="First name">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="contactLastName">Last Name *</label>
                  <input type="text" id="contactLastName" name="contactLastName" required placeholder="Last name">
                </div>
                <div class="form-group">
                  <label for="email">Email *</label>
                  <input type="email" id="email" name="email" required placeholder="your@email.com">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="phone">Telephone *</label>
                  <input type="tel" id="phone" name="phone" required placeholder="+27 XX XXX XXXX">
                </div>
                <div class="form-group">
                  <label for="industry">Industry Type *</label>
                  <select id="industry" name="industry" required>
                    <option value="">Please select...</option>
                    <option value="food-beverage">Food & Beverage</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="logistics">Logistics & Warehousing</option>
                    <option value="retail">Retail</option>
                    <option value="office">Office & Administration</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="companySize">Company Size *</label>
                <select id="companySize" name="companySize" required>
                  <option value="">Please select...</option>
                  <option value="small">Small (1-50 employees)</option>
                  <option value="medium">Medium (51-250 employees)</option>
                  <option value="large">Large (251-1000 employees)</option>
                  <option value="enterprise">Enterprise (1000+ employees)</option>
                </select>
              </div>
            </div>

            <!-- Step 3: Location Selection -->
            <div class="form-section" data-step="3" style="display: none;">
              <h3>Service Location *</h3>
              <p class="form-help-text">Click on the map to pinpoint your location or use the buttons below</p>
              
              <div class="location-buttons">
                <button type="button" class="btn-location" id="useCurrentLocation">📍 Use Current Location</button>
                <button type="button" class="btn-location" id="clearLocation">🗑️ Clear Selection</button>
              </div>

              <div id="mapContainer" class="map-container"></div>

              <div class="location-info">
                <p>Latitude: <span id="displayLat">Not selected</span></p>
                <p>Longitude: <span id="displayLng">Not selected</span></p>
              </div>

              <div class="form-group">
                <label for="addressName">Address / Location Name *</label>
                <input type="text" id="addressName" name="addressName" required placeholder="e.g., Head Office, Building A, etc.">
              </div>

              <div class="form-group">
                <label for="region">Region / Province *</label>
                <select id="region" name="region" required>
                  <option value="">Please select...</option>
                  <option value="bloemfontein">Bloemfontein</option>
                  <option value="cape-town">Cape Town</option>
                  <option value="durban">Durban</option>
                  <option value="east-london">East London</option>
                  <option value="george">George</option>
                  <option value="johannesburg">Johannesburg</option>
                  <option value="lesotho">Lesotho</option>
                  <option value="nelspruit">Nelspruit</option>
                  <option value="pietermaritzburg">Pietermaritzburg</option>
                  <option value="polokwane">Polokwane</option>
                  <option value="port-elizabeth">Port Elizabeth</option>
                  <option value="pretoria">Pretoria</option>
                  <option value="swaziland">Swaziland</option>
                </select>
              </div>
            </div>

            <!-- Step 4: Services Selection -->
            <div class="form-section" data-step="4" style="display: none;">
              <h3>Services Required *</h3>
              <p class="form-help-text">Select all services that apply (tick the boxes)</p>
              
              <div class="services-grid">
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="rodent-control" data-label="Rodent Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Rodent Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="cockroach-control" data-label="Cockroach Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Cockroach Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="termite-control" data-label="Termite Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Termite Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="fly-control" data-label="Fly Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Fly Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="mosquito-control" data-label="Mosquito Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Mosquito Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="bird-control" data-label="Bird Control">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Bird Control</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="disinfection" data-label="Hospital-Grade Disinfection">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Hospital-Grade Disinfection</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="ipm-monitoring" data-label="IPM Monitoring & Compliance">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">IPM Monitoring & Compliance</span>
                </label>
                <label class="service-checkbox">
                  <input type="checkbox" name="services" value="preventive-treatment" data-label="Preventive Treatment Program">
                  <span class="checkbox-custom"></span>
                  <span class="service-label">Preventive Treatment Program</span>
                </label>
              </div>

              <div class="form-group">
                <label for="additionalInfo">Additional Information</label>
                <textarea id="additionalInfo" name="additionalInfo" rows="4" placeholder="Tell us more about your pest control needs, current issues, or requirements..."></textarea>
              </div>
            </div>

            <!-- Navigation Buttons -->
            <div class="form-navigation">
              <button type="button" id="prevBtn" class="btn btn-secondary" style="display: none;">← Previous</button>
              <button type="button" id="nextBtn" class="btn btn-primary">Next →</button>
              <button type="submit" id="submitBtn" class="btn btn-success" style="display: none;">Submit Quote Request</button>
            </div>

            <!-- Progress Indicator -->
            <div class="form-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 25%;"></div>
              </div>
              <p class="progress-text">Step <span class="current-step">1</span> of 4</p>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    // Overlay button click
    const overlayBtn = document.getElementById('quoteOverlayBtn');
    if (overlayBtn) {
      overlayBtn.addEventListener('click', () => {
        console.log('Overlay button clicked');
        this.openModal();
      });
    }
    
    // Modal controls
    const openBtn = document.getElementById('openQuoteModal');
    const modal = document.getElementById('quoteModal');
    const closeBtn = document.querySelector('.quote-modal-close');
    const overlay = document.querySelector('.quote-modal-overlay');

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        console.log('Open button clicked');
        this.openModal();
      });
    } else {
      console.warn('Open button not found');
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('Close button clicked');
        this.closeModal();
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        console.log('Overlay clicked');
        this.closeModal();
      });
    }

    // Navigation
    document.getElementById('nextBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.nextStep();
    });
    document.getElementById('prevBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.prevStep();
    });

    // Form submission
    document.getElementById('quoteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitForm();
    });

    // Service type change
    document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.serviceType = e.target.value;
      });
    });

    // Services checkboxes
    document.querySelectorAll('input[name="services"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedServices.add(e.target.value);
        } else {
          this.selectedServices.delete(e.target.value);
        }
      });
    });

    // Location buttons
    document.getElementById('useCurrentLocation').addEventListener('click', (e) => {
      e.preventDefault();
      this.useCurrentLocation();
    });
    document.getElementById('clearLocation').addEventListener('click', (e) => {
      e.preventDefault();
      this.clearLocation();
    });
  }

  initializeMap() {
    // Map will be initialized when step 3 is displayed
  }

  openModal() {
    const modal = document.getElementById('quoteModal');
    const overlay = document.getElementById('quoteOverlay');
    
    if (!modal) {
      console.error('Modal element not found');
      return;
    }
    
    // Hide overlay banner
    if (overlay) {
      overlay.classList.add('hidden');
    }
    
    // Show form modal
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    this.currentStep = 1;
    this.updateStepDisplay();
    console.log('✓ Quote Modal opened');
  }

  closeModal() {
    const modal = document.getElementById('quoteModal');
    const overlay = document.getElementById('quoteOverlay');
    
    if (!modal) return;
    
    // Hide form modal
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    
    // Show overlay banner again
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    
    console.log('✓ Quote Modal closed');
  }

  nextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.currentStep < 4) {
      this.currentStep++;
      this.updateStepDisplay();

      // Initialize map when reaching step 3
      if (this.currentStep === 3 && !this.map) {
        setTimeout(() => this.initLeafletMap(), 100);
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepDisplay();
    }
  }

  updateStepDisplay() {
    // Hide all sections
    document.querySelectorAll('.form-section').forEach(section => {
      section.style.display = 'none';
    });

    // Show current section
    document.querySelector(`[data-step="${this.currentStep}"]`).style.display = 'block';

    // Update buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');

    if (this.currentStep === 1) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'block';
      submitBtn.style.display = 'none';
    } else if (this.currentStep === 4) {
      prevBtn.style.display = 'block';
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'block';
    } else {
      prevBtn.style.display = 'block';
      nextBtn.style.display = 'block';
      submitBtn.style.display = 'none';
    }

    // Update progress
    const progressFill = document.querySelector('.progress-fill');
    const progressStep = document.querySelector('.current-step');
    const progress = (this.currentStep / 4) * 100;
    progressFill.style.width = progress + '%';
    progressStep.textContent = this.currentStep;
  }

  validateCurrentStep() {
    const form = document.getElementById('quoteForm');
    const section = document.querySelector(`[data-step="${this.currentStep}"]`);
    const inputs = section.querySelectorAll('input[required], select[required], textarea[required]');

    let isValid = true;
    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('error');
        isValid = false;
      } else {
        input.classList.remove('error');
      }
    });

    // Validate services on step 4
    if (this.currentStep === 4 && this.selectedServices.size === 0) {
      alert('Please select at least one service');
      return false;
    }

    // Validate location on step 3
    if (this.currentStep === 3 && !this.selectedLat) {
      alert('Please select a location on the map');
      return false;
    }

    return isValid;
  }

  initLeafletMap() {
    if (this.map) return;

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // Default center (South Africa center)
    const defaultLat = -25.9655;
    const defaultLng = 28.1921;

    this.map = L.map('mapContainer').setView([defaultLat, defaultLng], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      minZoom: 4
    }).addTo(this.map);

    this.map.on('click', (e) => {
      this.setMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  setMarker(lat, lng) {
    this.selectedLat = lat;
    this.selectedLng = lng;

    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    this.marker = L.marker([lat, lng]).addTo(this.map);
    this.map.setView([lat, lng], 12);

    document.getElementById('displayLat').textContent = lat.toFixed(6);
    document.getElementById('displayLng').textContent = lng.toFixed(6);
  }

  useCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.setMarker(lat, lng);
        },
        (error) => {
          alert('Unable to get current location. Please allow location access or click on the map to select a location.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser. Please click on the map to select a location.');
    }
  }

  clearLocation() {
    this.selectedLat = null;
    this.selectedLng = null;
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    document.getElementById('displayLat').textContent = 'Not selected';
    document.getElementById('displayLng').textContent = 'Not selected';
  }

  submitForm() {
    if (!this.validateCurrentStep()) {
      return;
    }

    const formData = {
      serviceType: this.serviceType,
      companyName: document.getElementById('companyName').value,
      contactFirstName: document.getElementById('contactFirstName').value,
      contactLastName: document.getElementById('contactLastName').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      industry: document.getElementById('industry').value,
      companySize: document.getElementById('companySize').value,
      addressName: document.getElementById('addressName').value,
      region: document.getElementById('region').value,
      latitude: this.selectedLat,
      longitude: this.selectedLng,
      services: Array.from(this.selectedServices),
      additionalInfo: document.getElementById('additionalInfo').value
    };

    console.log('Quote Request Data:', formData);

    // Send to API
    this.sendToAPI(formData);
  }

  sendToAPI(formData) {
    const apiBase = document.querySelector('meta[name="aws-api-base"]')?.getAttribute('content') || 'http://localhost:8000/api';
    
    fetch(`${apiBase}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (!response.ok) throw new Error('API request failed');
      return response.json();
    })
    .then(data => {
      alert('Thank you! Your quote request has been submitted. We will contact you shortly.');
      this.resetForm();
      this.closeModal();
    })
    .catch(error => {
      console.error('Error:', error);
      alert('There was an error submitting your request. Please try again or contact us directly.');
    });
  }

  resetForm() {
    document.getElementById('quoteForm').reset();
    this.selectedServices.clear();
    this.selectedLat = null;
    this.selectedLng = null;
    this.currentStep = 1;
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
  }
}

// Initialize modal when DOM is ready
function initializeQuoteModal() {
  try {
    window.quoteModalInstance = new QuoteModal();
    console.log('✓ Quote Modal initialized successfully');
  } catch (error) {
    console.error('✗ Error initializing Quote Modal:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeQuoteModal);
} else {
  // DOM already loaded
  initializeQuoteModal();
}
