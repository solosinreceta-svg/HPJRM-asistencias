// =============================================
// MÓDULO DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS
// =============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userType = null;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 horas
        this.init();
    }

    init() {
        this.restoreSession();
        this.setupEventListeners();
    }

    // Validar formato de matrícula de estudiante
    validateMatricula(matricula) {
        const regex = /^2025\d{4}$/;
        return regex.test(matricula);
    }

    // Validar contraseña de administrador
    validateAdmin(password) {
        return password === "2025hpjrm";
    }

    // Iniciar sesión
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

            throw new Error('Credenciales inválidas. Use formato 2025XXXX para estudiantes o la contraseña de administrador.');
            
        } catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }

    // Manejar login de estudiante
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

    // Manejar login de administrador
    handleAdminLogin() {
        this.currentUser = 'admin';
        this.userType = 'admin';
        
        // Guardar sesión
        this.saveSession();
        
        return {
            success: true,
            type: 'admin',
            user: { nombre: 'Administrador' },
            message: 'Bienvenido Administrador'
        };
    }

    // Cerrar sesión
    logout() {
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

    // Guardar sesión
    saveSession() {
        const sessionData = {
            user: this.currentUser,
            type: this.userType,
            timestamp: Date.now()
        };
        
        localStorage.setItem('hpjrm_session', JSON.stringify(sessionData));
        localStorage.setItem('hpjrm_session_timestamp', Date.now().toString());
    }

    // Restaurar sesión
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
                this.logout();
                return false;
            }

            const session = JSON.parse(sessionData);
            this.currentUser = session.user;
            this.userType = session.type;

            // Verificar integridad de la sesión
            if (this.userType === 'student') {
                const student = DataManager.getStudent(this.currentUser);
                if (!student || !student.activo) {
                    this.logout();
                    return false;
                }
            }

            console.log('Sesión restaurada:', this.userType, this.currentUser);
            return true;
            
        } catch (error) {
            console.error('Error restaurando sesión:', error);
            this.logout();
            return false;
        }
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
    }

    // Manejar formulario de login
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
            loginBtn.innerHTML = '<div class="loading-spinner"></div> Iniciando sesión...';
            loginBtn.disabled = true;

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
            this.showAlert(error.message, 'error');
            console.error('Error en login:', error);
        } finally {
            // Restaurar botón
            loginBtn.innerHTML = 'Ingresar';
            loginBtn.disabled = false;
        }
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
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos cuando se carga el script
loadAuthStyles();

// Crear instancia global
const authManager = new AuthManager();