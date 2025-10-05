// =============================================
// MÓDULO DE GEOLOCALIZACIÓN Y VERIFICACIÓN GPS
// =============================================

class GeolocationManager {
    constructor() {
        this.hospitalCoordinates = {
            lat: 22.930857,
            lng: -82.689359
        };
        this.allowedRadius = 500; // metros
        this.currentPosition = null;
        this.positionWatchId = null;
        this.isTracking = false;
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
    }

    // Cargar configuración desde almacenamiento
    loadSettings() {
        try {
            const settings = DataManager.getSettings();
            if (settings) {
                this.hospitalCoordinates = {
                    lat: settings.hospitalLat || 22.930857,
                    lng: settings.hospitalLng || -82.689359
                };
                this.allowedRadius = settings.gpsRadius || 500;
            }
        } catch (error) {
            console.error('Error cargando configuración GPS:', error);
        }
    }

    // Obtener ubicación actual con alta precisión
    async getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('La geolocalización no es soportada por este navegador'));
                return;
            }

            const defaultOptions = {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000 // 5 minutos
            };

            const finalOptions = { ...defaultOptions, ...options };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };

                    this.currentPosition = coords;
                    this.updateLocationDisplay(coords);
                    
                    resolve(coords);
                },
                (error) => {
                    const errorMessage = this.getGeolocationError(error);
                    console.error('Error de geolocalización:', errorMessage);
                    reject(new Error(errorMessage));
                },
                finalOptions
            );
        });
    }

    // Iniciar seguimiento continuo de ubicación
    startTracking() {
        if (this.isTracking) return;

        try {
            this.positionWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };

                    this.currentPosition = coords;
                    this.updateLocationDisplay(coords);
                    
                    // Emitir evento de ubicación actualizada
                    this.emitLocationUpdate(coords);
                },
                (error) => {
                    const errorMessage = this.getGeolocationError(error);
                    console.warn('Error en seguimiento GPS:', errorMessage);
                    this.updateLocationStatus('error', errorMessage);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }
            );

            this.isTracking = true;
            console.log('Seguimiento GPS iniciado');
            
        } catch (error) {
            console.error('Error iniciando seguimiento GPS:', error);
        }
    }

    // Detener seguimiento de ubicación
    stopTracking() {
        if (this.positionWatchId && this.isTracking) {
            navigator.geolocation.clearWatch(this.positionWatchId);
            this.positionWatchId = null;
            this.isTracking = false;
            console.log('Seguimiento GPS detenido');
        }
    }

    // Calcular distancia usando fórmula Haversine
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return Math.round(distance);
    }

    // Convertir grados a radianes
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    // Verificar si la ubicación está dentro del radio permitido
    isWithinHospitalRadius(userCoords) {
        if (!userCoords || !userCoords.lat || !userCoords.lng) {
            return { valid: false, distance: 0, reason: 'Coordenadas inválidas' };
        }

        const distance = this.calculateDistance(
            userCoords.lat, userCoords.lng,
            this.hospitalCoordinates.lat, this.hospitalCoordinates.lng
        );

        const isValid = distance <= this.allowedRadius;
        
        return {
            valid: isValid,
            distance: distance,
            accuracy: userCoords.accuracy || 0,
            reason: isValid ? 
                `Dentro del radio permitido (${distance}m)` : 
                `Fuera del radio permitido (${distance}m > ${this.allowedRadius}m)`
        };
    }

    // Verificar ubicación para registro de asistencia
    async verifyLocationForAttendance() {
        try {
            this.updateLocationStatus('loading', 'Obteniendo ubicación...');

            const position = await this.getCurrentPosition();
            const verification = this.isWithinHospitalRadius(position);

            if (verification.valid) {
                this.updateLocationStatus('success', verification.reason);
                return {
                    success: true,
                    position: position,
                    verification: verification
                };
            } else {
                this.updateLocationStatus('error', verification.reason);
                return {
                    success: false,
                    position: position,
                    verification: verification,
                    error: verification.reason
                };
            }

        } catch (error) {
            this.updateLocationStatus('error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Actualizar display de ubicación en la UI
    updateLocationDisplay(coords) {
        const verification = this.isWithinHospitalRadius(coords);
        const statusElement = document.getElementById('location-status');
        const textElement = document.getElementById('location-text');

        if (!statusElement || !textElement) return;

        if (verification.valid) {
            statusElement.className = 'status-item valid';
            statusElement.querySelector('.status-icon').textContent = '📍';
            textElement.textContent = `En hospital (${verification.distance}m)`;
        } else {
            statusElement.className = 'status-item error';
            statusElement.querySelector('.status-icon').textContent = '❌';
            textElement.textContent = `Fuera (${verification.distance}m)`;
        }
    }

    // Actualizar estado de ubicación
    updateLocationStatus(status, message) {
        const statusElement = document.getElementById('location-status');
        const textElement = document.getElementById('location-text');

        if (!statusElement || !textElement) return;

        const iconElement = statusElement.querySelector('.status-icon');
        
        switch (status) {
            case 'loading':
                statusElement.className = 'status-item loading';
                iconElement.textContent = '⏳';
                textElement.textContent = message;
                break;
            case 'success':
                statusElement.className = 'status-item valid';
                iconElement.textContent = '📍';
                textElement.textContent = message;
                break;
            case 'error':
                statusElement.className = 'status-item error';
                iconElement.textContent = '❌';
                textElement.textContent = message;
                break;
            default:
                statusElement.className = 'status-item';
                iconElement.textContent = '📍';
                textElement.textContent = message;
        }
    }

    // Obtener mensaje de error de geolocalización
    getGeolocationError(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return 'Permiso de ubicación denegado. Active la ubicación en configuraciones.';
            case error.POSITION_UNAVAILABLE:
                return 'Información de ubicación no disponible.';
            case error.TIMEOUT:
                return 'Tiempo de espera agotado para obtener ubicación.';
            default:
                return 'Error desconocido al obtener ubicación.';
        }
    }

    // Emitir evento de actualización de ubicación
    emitLocationUpdate(coords) {
        const event = new CustomEvent('locationUpdated', {
            detail: {
                coords: coords,
                verification: this.isWithinHospitalRadius(coords)
            }
        });
        document.dispatchEvent(event);
    }

    // Configurar event listeners
    setupEventListeners() {
        // Escuchar cambios de configuración
        document.addEventListener('settingsUpdated', () => {
            this.loadSettings();
        });

        // Iniciar seguimiento cuando se active el escáner
        document.addEventListener('scannerActivated', () => {
            this.startTracking();
        });

        // Detener seguimiento cuando se cierre el escáner
        document.addEventListener('scannerDeactivated', () => {
            this.stopTracking();
        });
    }

    // Obtener coordenadas del hospital
    getHospitalCoordinates() {
        return { ...this.hospitalCoordinates };
    }

    // Actualizar configuración de ubicación
    updateLocationSettings(settings) {
        if (settings.hospitalLat && settings.hospitalLng) {
            this.hospitalCoordinates = {
                lat: settings.hospitalLat,
                lng: settings.hospitalLng
            };
        }
        
        if (settings.gpsRadius) {
            this.allowedRadius = settings.gpsRadius;
        }

        console.log('Configuración GPS actualizada:', this.hospitalCoordinates, this.allowedRadius);
    }

    // Verificar permisos de ubicación
    async checkLocationPermissions() {
        if (!navigator.permissions) {
            return 'unknown';
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state;
        } catch (error) {
            console.error('Error verificando permisos:', error);
            return 'unknown';
        }
    }

    // Solicitar permisos de ubicación
    async requestLocationPermission() {
        try {
            const position = await this.getCurrentPosition({ timeout: 5000 });
            return { granted: true, position };
        } catch (error) {
            return { granted: false, error: error.message };
        }
    }

    // Obtener estadísticas de ubicación
    getLocationStats() {
        return {
            hospitalCoordinates: this.hospitalCoordinates,
            allowedRadius: this.allowedRadius,
            currentPosition: this.currentPosition,
            isTracking: this.isTracking,
            lastUpdate: this.currentPosition ? new Date(this.currentPosition.timestamp) : null
        };
    }

    // Formatear coordenadas para display
    formatCoordinates(coords) {
        if (!coords) return 'No disponible';
        
        return `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`;
    }

    // Calcular tiempo en hospital (para estadísticas)
    calculateHospitalStayTime(entryRecord, exitRecord) {
        if (!entryRecord || !exitRecord) return 0;
        
        const entryTime = new Date(entryRecord.asistencia.timestamp);
        const exitTime = new Date(exitRecord.asistencia.timestamp);
        
        return Math.round((exitTime - entryTime) / (1000 * 60)); // minutos
    }
}

// Estilos para estados de ubicación
const loadGeolocationStyles = () => {
    const styles = `
        .status-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 8px;
            transition: all 0.3s ease;
        }
        
        .status-item.valid {
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.3);
            color: #155724;
        }
        
        .status-item.error {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            color: #721c24;
        }
        
        .status-item.loading {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            color: #856404;
        }
        
        .status-icon {
            font-size: 18px;
            width: 20px;
            text-align: center;
        }
        
        .location-details {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos
loadGeolocationStyles();

// Crear instancia global
const geolocationManager = new GeolocationManager();