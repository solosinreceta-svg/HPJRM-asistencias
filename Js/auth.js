// =============================================
// MÓDULO DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS
// =============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userType = null;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 horas
        this.adminPassword = "H0sp1t4l_2024!"; // Contraseña segura
        this.init();
    }

    init() {
        this.restoreSession();
        this.setupEventListeners();
    }

    // Validar formato de matrícula de estudiante - CORREGIDO
    validateMatricula(matricula) {
        const regex = /^2025\d{4}$/; // EXACTAMENTE 2025 + 4 dígitos
        return regex.test(matricula);
    }

    // Validar contraseña de administrador - CORREGIDO
    validateAdmin(password) {
        return password === this.adminPassword;
    }

    // Iniciar sesión - MEJORADO
    async login(credentials) {
        try {
            // Limpiar y validar credenciales
            const cleanCreds = credentials.trim();
            
            if (!cleanCreds) {
                throw new Error('Por favor ingrese sus credenciales');
            }

            // Verificar si es estudiante
            if (this.validateMatricula(cleanCreds)) {
                return await this.handleStudentLogin(cleanCreds);
            }

            // Verificar si es administrador
            if (this.validateAdmin(cleanCreds)) {
                return this.handleAdminLogin();
            }

            // Mensaje genérico de error sin revelar información
            throw new Error('Credenciales inválidas. Verifique su matrícula o contraseña.');
            
        } catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }

    // Manejar login de estudiante - MEJORADO
    async handleStudentLogin(matricula) {
        // Verificar si el estudiante existe
        let student = DataManager.getStudent(matricula);
        
        if (!student) {
            // Crear estudiante nuevo si no existe
            student = {
                matricula: matricula,
                nombre: '',
                carrera: 'Medicina',
                grupo: '',
                activo: true,
                fechaRegistro: new Date().toISOString()
            };
            
            // Validar que sea una matrícula del año actual
            const currentYear = new Date().getFullYear();
            const studentYear = parseInt(matricula.substring(0, 4));
            
            if (studentYear !== currentYear) {
                throw new Error('Matrícula no corresponde al año actual');
            }
            
            DataManager.createStudent(student);
        }

        // Verificar si el estudiante está activo
        if (!student.activo) {
            throw new Error('Su cuenta está desactivada. Contacte al administrador.');
        }

        this.currentUser = matricula;
        this.userType = 'student';
        
        // Guardar sesión
        this.saveSession();
        
        return {
            success: true,
            type: 'student',
            user: student,
            message: `Bienvenido ${student.nombre || 'Estudiante'}`
        };
    }

    // Manejar login de administrador - MEJORADO
    handleAdminLogin() {
        this.currentUser = 'admin';
        this.userType = 'admin';
        
        // Guardar sesión
        this.saveSession();
        
        // Registrar el acceso admin en logs
        this.logAdminAccess();
        
        return {
            success: true,
            type: 'admin',
            user: { nombre: 'Administrador' },
            message: 'Acceso administrativo concedido'
        };
    }

    // Registrar acceso de administrador
    logAdminAccess() {
        const log = {
            timestamp: new Date().toISOString(),
            type: 'admin_login',
            user: 'admin',
            ip: 'unknown', // En una app real obtendrías la IP
            userAgent: navigator.userAgent
        };
        
        // Guardar log de seguridad
        const securityLogs = JSON.parse(localStorage.getItem('hpjrm_security_logs') || '[]');
        securityLogs.push(log);
        localStorage.setItem('hpjrm_security_logs', JSON.stringify(securityLogs.slice(-100))); // Mantener últimos 100
    }

    // Cerrar sesión - MEJORADO
    logout() {
        // Registrar logout si hay usuario
        if (this.currentUser) {
            this.logLogout();
        }
        
        this.currentUser = null;
        this.userType = null;
        
        // Limpiar almacenamiento de sesión
        localStorage.removeItem('hpjrm_session');
        localStorage.removeItem('hpjrm_session_timestamp');
        
        // Redirigir a login
        UIManager.showScreen('login-screen');
        
        // Limpiar formularios
        this.clearForms();
        
        console.log('Sesión cerrada correctamente');
    }

    // Registrar cierre de sesión
    logLogout() {
        const log = {
            timestamp: new Date().toISOString(),
            type: 'logout',
            user: this.currentUser,
            userType: this.userType
        };
        
        const securityLogs = JSON.parse(localStorage.getItem('hpjrm_security_logs') || '[]');
        securityLogs.push(log);
        localStorage.setItem('hpjrm_security_logs', JSON.stringify(securityLogs.slice(-100)));
    }

    // Guardar sesión
    saveSession() {
        const sessionData = {
            user: this.currentUser,
            type: this.userType,
            timestamp: Date.now(),
            sessionId: this.generateSessionId()
        };
        
        localStorage.setItem('hpjrm_session', JSON.stringify(sessionData));
        localStorage.setItem('hpjrm_session_timestamp', Date.now().toString());
    }

    // Generar ID de sesión único
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Restaurar sesión - MEJORADO
    restoreSession() {
        try {
            const sessionData = localStorage.getItem('hpjrm_session');
            const sessionTimestamp = localStorage.getItem('hpjrm_session_timestamp');
            
            if (!sessionData || !sessionTimestamp) {
                return false;
            }

            // Verificar si la sesión ha expirado
            const now = Date.now();
            const sessionTime = parseInt(sessionTimestamp);
            
            if (now - sessionTime > this.sessionTimeout) {
                this.logSessionTimeout();
                this.logout();
                return false;
            }

            const session = JSON.parse(sessionData);
            
            // Validar estructura de sesión
            if (!session.user || !session.type) {
                this.logout();
                return false;
            }

            this.currentUser = session.user;
            this.userType = session.type;

            // Verificar integridad de la sesión
            if (this.userType === 'student') {
                const student = DataManager.getStudent(this.currentUser);
                if (!student || !student.activo) {
                    this.logInvalidSession();
                    this.logout();
                    return false;
                }
            } else if (this.userType === 'admin') {
                // Para admin, solo verificar que la sesión sea válida
                if (session.user !== 'admin') {
                    this.logInvalidSession();
                    this.logout();
                    return false;
                }
            } else {
                // Tipo de usuario desconocido
                this.logout();
                return false;
            }

            console.log('Sesión restaurada:', this.userType, this.currentUser);
            return true;
            
        } catch (error) {
            console.error('Error restaurando sesión:', error);
            this.logSessionError(error);
            this.logout();
            return false;
        }
    }

    // Logs de seguridad
    logSessionTimeout() {
        this.logSecurityEvent('session_timeout');
    }

    logInvalidSession() {
        this.logSecurityEvent('invalid_session');
    }

    logSessionError(error) {
        this.logSecurityEvent('session_error', { error: error.message });
    }

    logSecurityEvent(eventType, extraData = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            user: this.currentUser,
            userType: this.userType,
            ...extraData
        };
        
        const securityLogs = JSON.parse(localStorage.getItem('hpjrm_security_logs') || '[]');
        securityLogs.push(event);
        localStorage.setItem('hpjrm_security_logs', JSON.stringify(securityLogs.slice(-100)));
    }

    // Verificar si hay sesión activa
    isLoggedIn() {
        return this.currentUser !== null && this.userType !== null;
    }

    // Obtener información del usuario actual
    getCurrentUser() {
        if (!this.isLoggedIn()) {
            return null;
        }

        if (this.userType === 'student') {
            const student = DataManager.getStudent(this.currentUser);
            return {
                type: 'student',
                matricula: this.currentUser,
                nombre: student?.nombre || 'Estudiante',
                grupo: student?.grupo || '',
                carrera: student?.carrera || 'Medicina'
            };
        }

        return {
            type: 'admin',
            nombre: 'Administrador'
        };
    }

    // Verificar permisos
    hasPermission(requiredType) {
        if (!this.isLoggedIn()) return false;
        
        if (requiredType === 'admin') {
            return this.userType === 'admin';
        }
        
        if (requiredType === 'student') {
            return this.userType === 'student';
        }
        
        return true;
    }

    // Configurar event listeners
    setupEventListeners() {
        // Login form
        document.getElementById('login-btn').addEventListener('click', () => {
            this.handleLoginForm();
        });

        // Login con Enter
        document.getElementById('login-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLoginForm();
            }
        });

        // Logout buttons
        document.getElementById('student-logout').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('admin-logout').addEventListener('click', () => {
            this.logout();
        });

        // Auto-logout por inactividad
        this.setupInactivityTimer();

        // Prevenir inspección en producción
        this.setupSecurityMeasures();
    }

    // Medidas de seguridad adicionales
    setupSecurityMeasures() {
        // Prevenir el acceso a la consola en producción
        if (window.location.protocol === 'https:') {
            setInterval(() => {
                if (this.userType === 'admin') {
                    this.checkTampering();
                }
            }, 30000);
        }
    }

    // Verificar manipulación del cliente
    checkTampering() {
        // Verificar que las funciones críticas no hayan sido modificadas
        if (this.validateMatricula.toString().includes('alert') || 
            this.validateAdmin.toString().includes('alert')) {
            this.logSecurityEvent('possible_tampering');
            this.logout();
            UIManager.showAlert('Actividad sospechosa detectada. Sesión cerrada por seguridad.', 'error');
        }
    }

    // Manejar formulario de login - MEJORADO
    async handleLoginForm() {
        const loginInput = document.getElementById('login-input');
        const loginAlert = document.getElementById('login-alert');
        const loginBtn = document.getElementById('login-btn');
        
        const credentials = loginInput.value.trim();
        
        if (!credentials) {
            this.showAlert('Por favor ingrese sus credenciales', 'error');
            return;
        }

        try {
            // Mostrar estado de carga
            loginBtn.innerHTML = '<div class="loading-spinner"></div> Verificando...';
            loginBtn.disabled = true;

            // Pequeño delay para prevenir fuerza bruta
            await new Promise(resolve => setTimeout(resolve, 500));

            const result = await this.login(credentials);
            
            if (result.success) {
                this.showAlert(result.message, 'success');
                
                // Redirigir según tipo de usuario
                setTimeout(() => {
                    if (result.type === 'student') {
                        UIManager.showScreen('student-dashboard');
                        UIManager.updateStudentDashboard();
                    } else if (result.type === 'admin') {
                        UIManager.showScreen('admin-dashboard');
                        UIManager.updateAdminDashboard();
                    }
                }, 1000);
            }
            
        } catch (error) {
            // Log de intento fallido
            this.logFailedAttempt(credentials);
            this.showAlert(error.message, 'error');
            console.error('Error en login:', error);
        } finally {
            // Restaurar botón
            loginBtn.innerHTML = 'Ingresar';
            loginBtn.disabled = false;
            
            // Limpiar campo de password después de intento fallido
            if (this.isPossiblePassword(credentials)) {
                loginInput.value = '';
            }
        }
    }

    // Verificar si el input podría ser una contraseña
    isPossiblePassword(input) {
        // Si no es una matrícula válida, podría ser password
        return !this.validateMatricula(input) && input.length > 6;
    }

    // Registrar intentos fallidos
    logFailedAttempt(credentials) {
        const attempt = {
            timestamp: new Date().toISOString(),
            credentials: credentials.substring(0, 3) + '***', // No guardar completo
            userAgent: navigator.userAgent,
            ip: 'unknown'
        };
        
        const failedAttempts = JSON.parse(localStorage.getItem('hpjrm_failed_attempts') || '[]');
        failedAttempts.push(attempt);
        
        // Mantener solo últimos 20 intentos
        localStorage.setItem('hpjrm_failed_attempts', JSON.stringify(failedAttempts.slice(-20)));
        
        // Bloquear después de 5 intentos fallidos en 15 minutos
        this.checkBruteForceProtection();
    }

    // Protección contra fuerza bruta
    checkBruteForceProtection() {
        const failedAttempts = JSON.parse(localStorage.getItem('hpjrm_failed_attempts') || '[]');
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        
        const recentAttempts = failedAttempts.filter(attempt => 
            new Date(attempt.timestamp) > fifteenMinutesAgo
        );
        
        if (recentAttempts.length >= 5) {
            this.lockSystemTemporarily();
        }
    }

    // Bloquear sistema temporalmente
    lockSystemTemporarily() {
        const lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutos
        localStorage.setItem('hpjrm_system_lock', lockUntil.toString());
        
        this.showAlert('Demasiados intentos fallidos. Sistema bloqueado por 15 minutos.', 'error');
        
        // Deshabilitar login
        document.getElementById('login-btn').disabled = true;
        document.getElementById('login-input').disabled = true;
        
        setTimeout(() => {
            localStorage.removeItem('hpjrm_system_lock');
            document.getElementById('login-btn').disabled = false;
            document.getElementById('login-input').disabled = false;
            this.showAlert('Sistema desbloqueado. Puede intentar nuevamente.', 'success');
        }, 15 * 60 * 1000);
    }

    // Verificar si el sistema está bloqueado
    isSystemLocked() {
        const lockUntil = localStorage.getItem('hpjrm_system_lock');
        if (lockUntil && Date.now() < parseInt(lockUntil)) {
            return true;
        }
        return false;
    }

    // Mostrar alertas
    showAlert(message, type = 'error') {
        const alertElement = document.getElementById('login-alert');
        alertElement.textContent = message;
        alertElement.className = `alert alert-${type}`;
        alertElement.classList.remove('hidden');
        
        // Ocultar automáticamente después de 5 segundos
        setTimeout(() => {
            alertElement.classList.add('hidden');
        }, 5000);
    }

    // Configurar timer de inactividad
    setupInactivityTimer() {
        let inactivityTime = 0;
        const maxInactivity = 30 * 60 * 1000; // 30 minutos
        
        const resetTimer = () => {
            inactivityTime = 0;
        };
        
        const inactivityInterval = setInterval(() => {
            if (!this.isLoggedIn()) return;
            
            // Verificar bloqueo del sistema
            if (this.isSystemLocked()) {
                this.logout();
                this.showAlert('Sistema bloqueado temporalmente', 'warning');
                clearInterval(inactivityInterval);
                return;
            }
            
            inactivityTime += 1000;
            
            if (inactivityTime >= maxInactivity) {
                this.logout();
                this.showAlert('Sesión cerrada por inactividad', 'warning');
                clearInterval(inactivityInterval);
            }
        }, 1000);
        
        // Resetear timer en eventos de usuario
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });
    }

    // Limpiar formularios
    clearForms() {
        document.getElementById('login-input').value = '';
        document.getElementById('login-alert').classList.add('hidden');
    }

    // Verificar estado de autenticación al cargar
    checkAuthStatus() {
        // Verificar bloqueo del sistema primero
        if (this.isSystemLocked()) {
            this.showAlert('Sistema bloqueado temporalmente por seguridad', 'error');
            document.getElementById('login-btn').disabled = true;
            document.getElementById('login-input').disabled = true;
            return;
        }
        
        if (this.isLoggedIn()) {
            const user = this.getCurrentUser();
            if (user.type === 'student') {
                UIManager.showScreen('student-dashboard');
                UIManager.updateStudentDashboard();
            } else if (user.type === 'admin') {
                UIManager.showScreen('admin-dashboard');
                UIManager.updateAdminDashboard();
            }
        } else {
            UIManager.showScreen('login-screen');
        }
    }

    // Cambiar estado de estudiante (solo admin)
    toggleStudentStatus(matricula, activo) {
        if (!this.hasPermission('admin')) {
            throw new Error('No tiene permisos para esta acción');
        }

        const student = DataManager.getStudent(matricula);
        if (!student) {
            throw new Error('Estudiante no encontrado');
        }

        student.activo = activo;
        DataManager.updateStudent(matricula, student);
        
        // Log de la acción
        this.logSecurityEvent('student_status_changed', {
            matricula: matricula,
            newStatus: activo
        });
        
        return {
            success: true,
            message: `Estudiante ${activo ? 'activado' : 'desactivado'} correctamente`
        };
    }

    // Obtener estadísticas de usuarios
    getUserStats() {
        const students = DataManager.getAllStudents();
        const activeStudents = students.filter(s => s.activo).length;
        const inactiveStudents = students.filter(s => !s.activo).length;
        
        return {
            total: students.length,
            active: activeStudents,
            inactive: inactiveStudents,
            activePercentage: students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0
        };
    }

    // Obtener logs de seguridad (solo admin)
    getSecurityLogs() {
        if (!this.hasPermission('admin')) {
            return [];
        }
        
        return JSON.parse(localStorage.getItem('hpjrm_security_logs') || '[]');
    }

    // Limpiar logs antiguos (solo admin)
    clearOldLogs() {
        if (!this.hasPermission('admin')) {
            throw new Error('No tiene permisos para esta acción');
        }
        
        // Mantener solo logs de los últimos 7 días
        const logs = this.getSecurityLogs();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const recentLogs = logs.filter(log => new Date(log.timestamp) > sevenDaysAgo);
        localStorage.setItem('hpjrm_security_logs', JSON.stringify(recentLogs));
        
        return {
            deleted: logs.length - recentLogs.length,
            remaining: recentLogs.length
        };
    }
}

// Estilos para el spinner de carga
const loadAuthStyles = () => {
    const styles = `
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none !important;
        }
        
        .security-warning {
            background-color: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            color: #721c24;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-size: 14px;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos cuando se carga el script
loadAuthStyles();

// Crear instancia global
const authManager = new AuthManager();
