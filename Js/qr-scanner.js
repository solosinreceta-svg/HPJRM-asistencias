// =============================================
// MÓDULO DE ESCÁNER QR CON CÁMARA REAL
// =============================================

class QRScanner {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasContext = null;
        this.stream = null;
        this.isScanning = false;
        this.currentCamera = 'environment'; // 'environment' (trasera), 'user' (frontal)
        this.scanInterval = null;
        this.isFlashAvailable = false;
        this.isFlashOn = false;
        this.currentScanType = 'entry'; // 'entry' o 'exit'
        this.init();
    }

    init() {
        this.videoElement = document.getElementById('scanner-video');
        this.canvasElement = document.getElementById('scanner-canvas');
        
        if (this.canvasElement) {
            this.canvasContext = this.canvasElement.getContext('2d', { willReadFrequently: true });
        }
        
        this.setupEventListeners();
        this.checkFlashAvailability();
    }

    // Iniciar escaneo QR
    async startScan(scanType = 'entry') {
        try {
            this.currentScanType = scanType;
            this.updateScannerUI(scanType);

            // Actualizar título del escáner
            const scannerTitle = document.getElementById('scanner-title');
            if (scannerTitle) {
                scannerTitle.textContent = scanType === 'entry' ? 
                    'Escanear QR de Entrada' : 'Escanear QR de Salida';
            }

            // Actualizar texto del escáner
            const scannerText = document.getElementById('scanner-type');
            if (scannerText) {
                scannerText.textContent = scanType === 'entry' ? 
                    'Escaneando código de entrada...' : 'Escaneando código de salida...';
            }

            // Solicitar permisos de cámara
            await this.requestCameraPermission();

            // Obtener stream de cámara
            const constraints = {
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Esperar a que el video esté listo
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play().then(resolve);
                };
            });

            // Configurar canvas
            if (this.canvasElement) {
                this.canvasElement.width = this.videoElement.videoWidth;
                this.canvasElement.height = this.videoElement.videoHeight;
            }

            this.isScanning = true;
            this.updateCameraStatus('active', 'Cámara activa - Escaneando...');

            // Iniciar loop de escaneo
            this.startScanLoop();

            // Emitir evento de escáner activado
            this.emitScannerEvent('scannerActivated');

            console.log(`Escáner QR iniciado (${scanType})`);

        } catch (error) {
            console.error('Error iniciando escáner QR:', error);
            this.handleScannerError(error);
            throw error;
        }
    }

    // Loop principal de escaneo
    startScanLoop() {
        this.scanInterval = setInterval(() => {
            if (!this.isScanning) return;
            this.scanQRCode();
        }, 500); // Escanear cada 500ms
    }

    // Escanear código QR
    scanQRCode() {
        if (!this.videoElement || !this.canvasContext) return;

        try {
            // Dibujar frame actual en canvas
            this.canvasContext.drawImage(
                this.videoElement,
                0, 0,
                this.canvasElement.width,
                this.canvasElement.height
            );

            // Obtener datos de imagen
            const imageData = this.canvasContext.getImageData(
                0, 0,
                this.canvasElement.width,
                this.canvasElement.height
            );

            // Escanear QR con jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (code) {
                this.onQRDetected(code.data);
            }

        } catch (error) {
            console.error('Error en escaneo QR:', error);
        }
    }

    // Manejar código QR detectado
    async onQRDetected(qrData) {
        console.log('QR detectado:', qrData);

        // Validar formato del QR
        if (!this.validateQRContent(qrData)) {
            this.showQRFeedback('invalid');
            return;
        }

        // Detener escaneo temporalmente
        this.stopScan();

        try {
            // Obtener ubicación actual
            this.updateLocationStatus('loading', 'Verificando ubicación...');
            
            const locationResult = await geolocationManager.verifyLocationForAttendance();
            
            if (!locationResult.success) {
                this.showQRFeedback('location_error');
                this.showScanResult({
                    success: false,
                    type: this.currentScanType,
                    error: locationResult.error,
                    qrData: qrData
                });
                return;
            }

            // Mostrar feedback de éxito
            this.showQRFeedback('success');

            // Registrar asistencia
            const user = authManager.getCurrentUser();
            if (user && user.type === 'student') {
                const attendanceResult = await DataManager.recordAttendance({
                    studentMatricula: user.matricula,
                    qrData: qrData,
                    location: locationResult.position,
                    scanType: this.currentScanType,
                    timestamp: Date.now()
                });

                // Mostrar resultado
                this.showScanResult(attendanceResult);

            } else {
                throw new Error('Usuario no autenticado');
            }

        } catch (error) {
            console.error('Error procesando QR:', error);
            this.showScanResult({
                success: false,
                type: this.currentScanType,
                error: error.message
            });
        }
    }

    // Validar contenido del QR
    validateQRContent(qrData) {
        // El QR debe contener exactamente "HPJRM"
        return qrData.trim().toUpperCase() === 'HPJRM';
    }

    // Detener escaneo
    stopScan() {
        this.isScanning = false;

        // Limpiar intervalos
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        // Detener stream de cámara
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }

        // Limpiar video
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        // Apagar flash
        if (this.isFlashOn) {
            this.toggleFlash(false);
        }

        // Emitir evento de escáner desactivado
        this.emitScannerEvent('scannerDeactivated');

        console.log('Escáner QR detenido');
    }

    // Cambiar entre cámaras
    async switchCamera() {
        if (!this.isScanning) return;

        try {
            this.stopScan();
            this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
            
            // Pequeña pausa para permitir que la cámara anterior se libere
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await this.startScan(this.currentScanType);
            
            this.updateCameraStatus('active', `Cámara ${this.currentCamera === 'environment' ? 'trasera' : 'frontal'} activa`);
            
        } catch (error) {
            console.error('Error cambiando cámara:', error);
            this.updateCameraStatus('error', 'Error cambiando cámara');
        }
    }

    // Alternar flash (si está disponible)
    async toggleFlash(forceState = null) {
        if (!this.stream) return;

        try {
            const videoTrack = this.stream.getVideoTracks()[0];
            if (!videoTrack) return;

            const capabilities = videoTrack.getCapabilities();
            if (!capabilities.torch) {
                this.isFlashAvailable = false;
                return;
            }

            this.isFlashAvailable = true;
            const newState = forceState !== null ? forceState : !this.isFlashOn;

            await videoTrack.applyConstraints({
                advanced: [{ torch: newState }]
            });

            this.isFlashOn = newState;
            
            // Actualizar UI del botón de flash
            const flashBtn = document.getElementById('toggle-flash-btn');
            if (flashBtn) {
                flashBtn.textContent = this.isFlashOn ? '🔦 Flash ON' : '⚡ Flash';
            }

        } catch (error) {
            console.error('Error controlando flash:', error);
            this.isFlashAvailable = false;
        }
    }

    // Verificar disponibilidad de flash
    async checkFlashAvailability() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.isFlashAvailable = false;
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const capabilities = videoTrack.getCapabilities();
                this.isFlashAvailable = !!capabilities.torch;
                
                // Detener stream de prueba
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (error) {
            console.warn('No se pudo verificar flash:', error);
            this.isFlashAvailable = false;
        }
    }

    // Solicitar permisos de cámara
    async requestCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            throw new Error('Permiso de cámara denegado o no disponible');
        }
    }

    // Manejar errores del escáner
    handleScannerError(error) {
        this.updateCameraStatus('error', this.getCameraError(error));
        
        // Mostrar opción de entrada manual
        this.showManualInputOption();
    }

    // Obtener mensaje de error de cámara
    getCameraError(error) {
        switch (error.name) {
            case 'NotAllowedError':
                return 'Permiso de cámara denegado. Active la cámara en configuraciones.';
            case 'NotFoundError':
                return 'Cámara no encontrada.';
            case 'NotSupportedError':
                return 'Cámara no soportada.';
            case 'NotReadableError':
                return 'Cámara no accesible (puede estar en uso por otra aplicación).';
            default:
                return 'Error de cámara: ' + error.message;
        }
    }

    // Mostrar opción de entrada manual
    showManualInputOption() {
        const manualSection = document.querySelector('.manual-input');
        if (manualSection) {
            manualSection.classList.remove('hidden');
        }
    }

    // Actualizar UI del escáner
    updateScannerUI(scanType) {
        const scannerType = document.getElementById('scanner-type');
        if (scannerType) {
            scannerType.textContent = scanType === 'entry' ? 
                'Escaneando código de ENTRADA...' : 'Escaneando código de SALIDA...';
            scannerType.className = `scanner-text ${scanType}`;
        }
    }

    // Actualizar estado de la cámara en UI
    updateCameraStatus(status, message) {
        const statusElement = document.getElementById('camera-status');
        const textElement = document.getElementById('camera-text');

        if (!statusElement || !textElement) return;

        const iconElement = statusElement.querySelector('.status-icon');
        
        switch (status) {
            case 'active':
                statusElement.className = 'status-item valid';
                iconElement.textContent = '📷';
                break;
            case 'error':
                statusElement.className = 'status-item error';
                iconElement.textContent = '❌';
                break;
            case 'loading':
                statusElement.className = 'status-item loading';
                iconElement.textContent = '⏳';
                break;
            default:
                statusElement.className = 'status-item';
                iconElement.textContent = '📷';
        }

        textElement.textContent = message;
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
                break;
            case 'success':
                statusElement.className = 'status-item valid';
                iconElement.textContent = '📍';
                break;
            case 'error':
                statusElement.className = 'status-item error';
                iconElement.textContent = '❌';
                break;
            default:
                statusElement.className = 'status-item';
                iconElement.textContent = '📍';
        }

        textElement.textContent = message;
    }

    // Mostrar feedback visual del QR
    showQRFeedback(type) {
        const scannerFrame = document.querySelector('.scanner-frame');
        if (!scannerFrame) return;

        // Remover clases anteriores
        scannerFrame.classList.remove('success', 'error', 'scanning');

        switch (type) {
            case 'success':
                scannerFrame.classList.add('success');
                this.playBeep('success');
                break;
            case 'invalid':
                scannerFrame.classList.add('error');
                this.playBeep('error');
                break;
            case 'location_error':
                scannerFrame.classList.add('error');
                this.playBeep('error');
                break;
            default:
                scannerFrame.classList.add('scanning');
        }

        // Remover clases después de un tiempo
        setTimeout(() => {
            scannerFrame.classList.remove('success', 'error', 'scanning');
        }, 2000);
    }

    // Reproducir sonido de feedback
    playBeep(type) {
        try {
            // Crear contexto de audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Configurar según el tipo
            if (type === 'success') {
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            } else {
                oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            }

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);

        } catch (error) {
            console.warn('No se pudo reproducir sonido:', error);
        }
    }

    // Mostrar resultado del escaneo
    showScanResult(result) {
        UIManager.showAttendanceResult(result);
    }

    // Emitir eventos del escáner
    emitScannerEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                scanner: this,
                ...detail
            }
        });
        document.dispatchEvent(event);
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botón de cambiar cámara
        document.getElementById('switch-camera-btn')?.addEventListener('click', () => {
            this.switchCamera();
        });

        // Botón de flash
        document.getElementById('toggle-flash-btn')?.addEventListener('click', () => {
            this.toggleFlash();
        });

        // Cerrar escáner
        document.getElementById('close-scanner-btn')?.addEventListener('click', () => {
            this.stopScan();
            UIManager.showScreen('student-dashboard');
        });

        // Entrada manual de QR
        document.getElementById('manual-entry-btn')?.addEventListener('click', () => {
            this.handleManualInput('entry');
        });

        document.getElementById('manual-exit-btn')?.addEventListener('click', () => {
            this.handleManualInput('exit');
        });

        // Limpiar al cambiar de pantalla
        document.addEventListener('screenChanged', (event) => {
            if (event.detail.screen !== 'scanner-screen') {
                this.stopScan();
            }
        });
    }

    // Manejar entrada manual de QR
    async handleManualInput(scanType) {
        const manualInput = document.getElementById('manual-qr-input');
        const qrData = manualInput?.value.trim();

        if (!qrData) {
            UIManager.showAlert('Por favor ingrese el código QR', 'error');
            return;
        }

        if (!this.validateQRContent(qrData)) {
            UIManager.showAlert('Código QR inválido. Debe contener "HPJRM"', 'error');
            return;
        }

        this.currentScanType = scanType;

        try {
            // Obtener ubicación
            const locationResult = await geolocationManager.verifyLocationForAttendance();
            
            if (!locationResult.success) {
                UIManager.showAlert(`Error de ubicación: ${locationResult.error}`, 'error');
                return;
            }

            // Registrar asistencia
            const user = authManager.getCurrentUser();
            if (user && user.type === 'student') {
                const attendanceResult = await DataManager.recordAttendance({
                    studentMatricula: user.matricula,
                    qrData: qrData,
                    location: locationResult.position,
                    scanType: scanType,
                    timestamp: Date.now(),
                    method: 'manual'
                });

                UIManager.showAttendanceResult(attendanceResult);

            } else {
                throw new Error('Usuario no autenticado');
            }

        } catch (error) {
            UIManager.showAlert(`Error: ${error.message}`, 'error');
        }

        // Limpiar input
        if (manualInput) {
            manualInput.value = '';
        }
    }

    // Obtener estadísticas del escáner
    getScannerStats() {
        return {
            isScanning: this.isScanning,
            currentCamera: this.currentCamera,
            isFlashAvailable: this.isFlashAvailable,
            isFlashOn: this.isFlashOn,
            currentScanType: this.currentScanType
        };
    }
}

// Estilos para el escáner QR
const loadQRScannerStyles = () => {
    const styles = `
        .scanner-frame.success {
            border-color: #28a745 !important;
            box-shadow: 0 0 0 1000px rgba(40, 167, 69, 0.3) !important;
            animation: pulseSuccess 2s ease-in-out;
        }
        
        .scanner-frame.error {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 1000px rgba(220, 53, 69, 0.3) !important;
            animation: pulseError 2s ease-in-out;
        }
        
        .scanner-frame.scanning {
            border-color: #ff6b35 !important;
            animation: pulseScanning 1.5s ease-in-out infinite;
        }
        
        @keyframes pulseSuccess {
            0% { border-color: #28a745; }
            50% { border-color: #20c997; }
            100% { border-color: #28a745; }
        }
        
        @keyframes pulseError {
            0% { border-color: #dc3545; }
            50% { border-color: #fd7e14; }
            100% { border-color: #dc3545; }
        }
        
        @keyframes pulseScanning {
            0% { border-color: #ff6b35; box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.5); }
            50% { border-color: #4a6ee0; box-shadow: 0 0 0 1000px rgba(74, 110, 224, 0.3); }
            100% { border-color: #ff6b35; box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.5); }
        }
        
        .scanner-text.entry {
            color: #28a745;
        }
        
        .scanner-text.exit {
            color: #ff6b35;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos
loadQRScannerStyles();

// Crear instancia global
const qrScanner = new QRScanner();