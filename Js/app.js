// =============================================
// ARCHIVO PRINCIPAL - INICIALIZACIÓN DE LA APP
// =============================================

class HPJRMApp {
    constructor() {
        this.appName = 'Asistencia Hospitalaria HPJRM';
        this.version = '1.0.0';
        this.isOnline = navigator.onLine;
        this.init();
    }

    async init() {
        try {
            console.log(`🚀 Iniciando ${this.appName} v${this.version}`);
            
            // Inicializar componentes en orden
            await this.initializeComponents();
            
            // Configurar event listeners globales
            this.setupGlobalEventListeners();
            
            // Verificar estado inicial
            this.checkInitialState();
            
            // Registrar Service Worker
            await this.registerServiceWorker();
            
            console.log('✅ Aplicación inicializada correctamente');
            
        } catch (error) {
            console.error('❌ Error inicializando aplicación:', error);
            this.showFatalError(error);
        }
    }

    async initializeComponents() {
        // Esperar a que el DOM esté completamente cargado
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Inicializar módulos en el orden correcto
        this.showLoadingScreen('Inicializando módulos...');
        
        // 1. DataManager (base de datos)
        await this.waitForComponent(() => window.dataManager, 'DataManager');
        
        // 2. AuthManager (autenticación)
        await this.waitForComponent(() => window.authManager, 'AuthManager');
        
        // 3. GeolocationManager (ubicación)
        await this.waitForComponent(() => window.geolocationManager, 'GeolocationManager');
        
        // 4. QRScanner (escáner)
        await this.waitForComponent(() => window.qrScanner, 'QRScanner');
        
        // 5. DashboardManager (UI)
        await this.waitForComponent(() => window.dashboardManager, 'DashboardManager');
        
        // 6. ReportsManager (reportes)
        await this.waitForComponent(() => window.reportsManager, 'ReportsManager');

        this.hideLoadingScreen();
    }

    async waitForComponent(checkFunction, componentName, maxWait = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkComponent = () => {
                if (checkFunction()) {
                    console.log(`✅ ${componentName} inicializado`);
                    resolve();
                } else if (Date.now() - startTime > maxWait) {
                    reject(new Error(`Timeout esperando ${componentName}`));
                } else {
                    setTimeout(checkComponent, 100);
                }
            };
            
            checkComponent();
        });
    }

    setupGlobalEventListeners() {
        // Detectar cambios de conexión
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });

        // Prevenir cierre con datos no guardados
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Manejar errors globales no capturados
        window.addEventListener('error', (e) => {
            console.error('Error global no capturado:', e.error);
            this.handleGlobalError(e.error);
        });

        // Manejar promesas rechazadas no capturadas
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Promesa rechazada no capturada:', e.reason);
            this.handleGlobalError(e.reason);
            e.preventDefault();
        });

        // Eventos de la aplicación
        document.addEventListener('appReady', () => {
            this.onAppReady();
        });

        document.addEventListener('authStateChanged', (e) => {
            this.onAuthStateChanged(e.detail);
        });

        document.addEventListener('attendanceRecorded', (e) => {
            this.onAttendanceRecorded(e.detail);
        });

        console.log('✅ Event listeners globales configurados');
    }

    checkInitialState() {
        // Verificar compatibilidad del navegador
        if (!this.checkBrowserCompatibility()) {
            this.showCompatibilityWarning();
            return;
        }

        // Verificar permisos esenciales
        this.checkEssentialPermissions();
        
        // Verificar almacenamiento disponible
        this.checkStorageAvailability();
        
        // Mostrar pantalla inicial según autenticación
        const user = authManager.getCurrentUser();
        if (user) {
            dashboardManager.showScreen(user.type === 'student' ? 'student-dashboard' : 'admin-dashboard');
        } else {
            dashboardManager.showScreen('login-screen');
        }

        // Emitir evento de aplicación lista
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('appReady'));
        }, 1000);
    }

    checkBrowserCompatibility() {
        const requiredFeatures = {
            'localStorage': !!window.localStorage,
            'geolocation': !!navigator.geolocation,
            'camera': !!navigator.mediaDevices?.getUserMedia,
            'serviceWorker': !!navigator.serviceWorker,
            'promises': !!window.Promise,
            'fetch': !!window.fetch
        };

        const missingFeatures = Object.entries(requiredFeatures)
            .filter(([_, supported]) => !supported)
            .map(([feature]) => feature);

        if (missingFeatures.length > 0) {
            console.warn('Características no soportadas:', missingFeatures);
            return false;
        }

        return true;
    }

    async checkEssentialPermissions() {
        try {
            // Verificar permisos de ubicación
            const locationPermission = await geolocationManager.checkLocationPermissions();
            if (locationPermission === 'denied') {
                this.showPermissionWarning('ubicación');
            }

            // Verificar permisos de cámara (solo cuando sea necesario)
            // Los permisos de cámara se solicitan cuando se usa el escáner

        } catch (error) {
            console.warn('Error verificando permisos:', error);
        }
    }

    checkStorageAvailability() {
        try {
            const testKey = 'hpjrm_storage_test';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.error('Almacenamiento no disponible:', error);
            this.showStorageWarning();
            return false;
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.mediaDevices.getUserMedia.register('/sw.js');
                console.log('✅ Service Worker registrado:', registration);
                
                // Verificar actualizaciones
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Nueva versión del Service Worker encontrada:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });
                
            } catch (error) {
                console.warn('❌ Service Worker no registrado:', error);
            }
        }
    }

    // ========== MANEJO DE ESTADOS ==========

    handleOnlineStatus(online) {
        this.isOnline = online;
        
        if (online) {
            this.showAppMessage('Conexión restaurada', 'success');
            // Sincronizar datos pendientes si es necesario
            this.syncPendingData();
        } else {
            this.showAppMessage('Modo offline activado', 'warning');
        }
        
        // Emitir evento
        document.dispatchEvent(new CustomEvent('connectivityChanged', {
            detail: { online }
        }));
    }

    async syncPendingData() {
        // En una implementación completa, aquí sincronizarías datos pendientes
        // con un servidor backend
        console.log('Sincronizando datos pendientes...');
    }

    hasUnsavedChanges() {
        // Verificar si hay datos no guardados
        // Por ahora, siempre retornamos false ya que todo se guarda automáticamente
        return false;
    }

    // ========== MANEJO DE ERRORES ==========

    handleGlobalError(error) {
        console.error('Error global manejado:', error);
        
        // No mostrar errores de recursos que no cargaron
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            return;
        }
        
        // Mostrar error al usuario solo si es crítico
        if (this.isCriticalError(error)) {
            this.showErrorModal(error);
        }
    }

    isCriticalError(error) {
        const nonCriticalErrors = [
            'camera not available',
            'geolocation not available',
            'network error'
        ];
        
        return !nonCriticalErrors.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    // ========== EVENT HANDLERS ==========

    onAppReady() {
        console.log('🎉 Aplicación completamente cargada y lista');
        
        // Mostrar mensaje de bienvenida
        this.showAppMessage(`${this.appName} lista para usar`, 'success');
        
        // Inicializar componentes que dependen de la app lista
        this.initializePostReadyComponents();
    }

    onAuthStateChanged(detail) {
        console.log('Estado de autenticación cambiado:', detail);
        
        // Actualizar UI según el cambio
        if (detail.loggedIn) {
            this.showAppMessage(`Bienvenido ${detail.user?.nombre || 'Usuario'}`, 'success');
        } else {
            this.showAppMessage('Sesión cerrada', 'info');
        }
    }

    onAttendanceRecorded(detail) {
        console.log('Asistencia registrada:', detail);
        
        // Mostrar notificación
        if (detail.record) {
            const type = detail.record.asistencia.tipo === 'entry' ? 'entrada' : 'salida';
            const status = detail.valid ? 'exitosa' : 'con advertencia';
            this.showAppMessage(`Registro de ${type} ${status}`, detail.valid ? 'success' : 'warning');
        }
        
        // Actualizar métricas en tiempo real si está en dashboard admin
        if (dashboardManager.currentScreen === 'admin-dashboard') {
            dashboardManager.updateAdminMetrics();
        }
    }

    initializePostReadyComponents() {
        // Componentes que se inicializan después de que la app esté lista
        setTimeout(() => {
            // Pre-cargar datos para mejor rendimiento
            this.preloadData();
            
            // Iniciar monitoreo de performance
            this.startPerformanceMonitoring();
        }, 2000);
    }

    async preloadData() {
        // Pre-cargar datos que se usarán frecuentemente
        try {
            await dataManager.getAllStudents();
            await dataManager.getSettings();
            console.log('✅ Datos pre-cargados para mejor rendimiento');
        } catch (error) {
            console.warn('Error pre-cargando datos:', error);
        }
    }

    // ========== MONITOREO DE PERFORMANCE ==========

    startPerformanceMonitoring() {
        // Monitorear métricas de performance
        if ('performance' in window) {
            const navTiming = performance.getEntriesByType('navigation')[0];
            if (navTiming) {
                console.log('📊 Métricas de carga:', {
                    'DOM Content Loaded': `${navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart}ms`,
                    'Load Complete': `${navTiming.loadEventEnd - navTiming.loadEventStart}ms`,
                    'Total Load Time': `${navTiming.loadEventEnd - navTiming.navigationStart}ms`
                });
            }
        }

        // Monitorear uso de memoria (si está disponible)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                console.log('🧠 Uso de memoria:', {
                    'Used JS Heap': `${Math.round(memory.usedJSHeapSize / 1048576)}MB`,
                    'Total JS Heap': `${Math.round(memory.totalJSHeapSize / 1048576)}MB`,
                    'Heap Limit': `${Math.round(memory.jsHeapSizeLimit / 1048576)}MB`
                });
            }, 30000); // Cada 30 segundos
        }
    }

    // ========== UI Y MENSAJES ==========

    showLoadingScreen(message = 'Cargando...') {
        // Crear o mostrar pantalla de carga
        let loadingScreen = document.getElementById('app-loading-screen');
        
        if (!loadingScreen) {
            loadingScreen = document.createElement('div');
            loadingScreen.id = 'app-loading-screen';
            loadingScreen.innerHTML = `
                <div class="loading-overlay">
                    <div class="loading-content">
                        <div class="loading-spinner-large"></div>
                        <h3>${this.appName}</h3>
                        <p>${message}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingScreen);
        }
        
        loadingScreen.style.display = 'flex';
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('app-loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    showAppMessage(message, type = 'info') {
        dashboardManager.showAlert(message, type);
    }

    showPermissionWarning(permission) {
        this.showAppMessage(
            `La aplicación necesita permisos de ${permission} para funcionar correctamente. Por favor, active los permisos en la configuración de su navegador.`,
            'warning'
        );
    }

    showStorageWarning() {
        this.showAppMessage(
            'El almacenamiento local no está disponible. Algunas funciones pueden no estar disponibles.',
            'error'
        );
    }

    showCompatibilityWarning() {
        this.showAppMessage(
            'Su navegador no es completamente compatible con todas las funciones de la aplicación. Considere actualizar su navegador.',
            'warning'
        );
    }

    showUpdateAvailable() {
        if (confirm('¡Nueva versión disponible! ¿Desea recargar la aplicación para actualizar?')) {
            window.location.reload();
        }
    }

    showErrorModal(error) {
        const errorMessage = error.message || 'Error desconocido';
        
        if (!document.getElementById('error-modal')) {
            const modal = document.createElement('div');
            modal.id = 'error-modal';
            modal.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <h3>❌ Error en la Aplicación</h3>
                        <p>${errorMessage}</p>
                        <div class="modal-actions">
                            <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-primary">
                                Cerrar
                            </button>
                            <button onclick="window.location.reload()" class="btn btn-secondary">
                                Recargar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    showFatalError(error) {
        console.error('❌ Error fatal:', error);
        
        document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 20px;
            ">
                <div>
                    <h1 style="font-size: 2em; margin-bottom: 20px;">😔</h1>
                    <h2 style="margin-bottom: 10px;">Error al cargar la aplicación</h2>
                    <p style="margin-bottom: 20px; opacity: 0.8;">
                        No se pudo inicializar la aplicación. Por favor, recargue la página.
                    </p>
                    <button onclick="window.location.reload()" 
                            style="
                                padding: 12px 24px;
                                background: white;
                                color: #667eea;
                                border: none;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                            ">
                        🔄 Recargar Aplicación
                    </button>
                    <div style="margin-top: 20px; font-size: 0.8em; opacity: 0.6;">
                        ${this.appName} v${this.version}
                    </div>
                </div>
            </div>
        `;
    }

    // ========== UTILIDADES PÚBLICAS ==========

    getAppInfo() {
        return {
            name: this.appName,
            version: this.version,
            online: this.isOnline,
            user: authManager.getCurrentUser(),
            components: {
                data: !!window.dataManager,
                auth: !!window.authManager,
                geo: !!window.geolocationManager,
                qr: !!window.qrScanner,
                dashboard: !!window.dashboardManager,
                reports: !!window.reportsManager
            }
        };
    }

    async backupAppData() {
        try {
            const backup = dataManager.createBackup();
            const blob = new Blob([JSON.stringify(backup, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_hpjrm_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showAppMessage('Backup creado correctamente', 'success');
            
        } catch (error) {
            console.error('Error creando backup:', error);
            this.showAppMessage('Error creando backup', 'error');
        }
    }

    async restoreAppData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    dataManager.restoreFromBackup(backupData);
                    this.showAppMessage('Datos restaurados correctamente', 'success');
                    resolve();
                } catch (error) {
                    this.showAppMessage('Error restaurando datos: Archivo inválido', 'error');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                this.showAppMessage('Error leyendo archivo', 'error');
                reject(new Error('Error leyendo archivo'));
            };
            
            reader.readAsText(file);
        });
    }

    // ========== DEBUG Y DESARROLLO ==========

    enableDebugMode() {
        window.DEBUG_MODE = true;
        console.log('🐛 Modo debug activado');
        
        // Exponer componentes globalmente para debugging
        window.app = this;
        window.components = {
            data: dataManager,
            auth: authManager,
            geo: geolocationManager,
            qr: qrScanner,
            ui: dashboardManager,
            reports: reportsManager
        };
    }

    printDebugInfo() {
        console.group('🔍 Información de Debug');
        console.log('App Info:', this.getAppInfo());
        console.log('Storage Usage:', this.getStorageUsage());
        console.log('Performance:', this.getPerformanceInfo());
        console.groupEnd();
    }

    getStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return {
            totalKeys: Object.keys(localStorage).length,
            totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
            estimatedSize: `${(totalSize / 1024).toFixed(2)} KB`
        };
    }

    getPerformanceInfo() {
        if (!('performance' in window)) return { available: false };
        
        const navTiming = performance.getEntriesByType('navigation')[0];
        const memory = 'memory' in performance ? performance.memory : null;
        
        return {
            navigation: navTiming ? {
                domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
                loadComplete: navTiming.loadEventEnd - navTiming.loadEventStart,
                total: navTiming.loadEventEnd - navTiming.navigationStart
            } : null,
            memory: memory ? {
                used: `${Math.round(memory.usedJSHeapSize / 1048576)}MB`,
                total: `${Math.round(memory.totalJSHeapSize / 1048576)}MB`,
                limit: `${Math.round(memory.jsHeapSizeLimit / 1048576)}MB`
            } : null
        };
    }
}

// Estilos globales para la aplicación
const loadAppStyles = () => {
    const styles = `
        #app-loading-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
        }
        
        .loading-overlay {
            text-align: center;
        }
        
        .loading-content h3 {
            margin: 20px 0 10px 0;
            font-size: 1.5em;
        }
        
        .loading-content p {
            opacity: 0.8;
        }
        
        .loading-spinner-large {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        
        .modal-content h3 {
            color: #dc3545;
            margin-bottom: 15px;
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Mejoras de accesibilidad */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        /* Mejoras de contraste para accesibilidad */
        @media (prefers-contrast: high) {
            :root {
                --primary: #0033cc;
                --secondary: #006600;
                --accent: #cc3300;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos globales
loadAppStyles();

// Crear e inicializar la aplicación
const hpjrmApp = new HPJRMApp();

// Exponer para acceso global (útil para debugging)
window.hpjrmApp = hpjrmApp;

// Inicialización inmediata para PWA
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        hpjrmApp.registerServiceWorker().catch(console.error);
    });
}

console.log('🚀 HPJRM App - Cargando aplicación...');