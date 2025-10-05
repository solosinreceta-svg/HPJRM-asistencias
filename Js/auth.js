// =============================================
// MÓDULO DE AUTENTICACIÓN - VERSIÓN SIMPLIFICADA
// =============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userType = null;
        this.init();
    }

    init() {
        console.log('🔐 AuthManager inicializado');
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    // Validar matrícula - SOLO 2025XXXX
    validateMatricula(matricula) {
        return /^2025\d{4}$/.test(matricula);
    }

    // Validar admin - CONTRASEÑA SIMPLE
    validateAdmin(password) {
        return password === "admin2024";
    }

    // Login principal
    async login(credentials) {
        const cleanCreds = credentials.trim();
        
        if (!cleanCreds) {
            throw new Error('Por favor ingrese sus credenciales');
        }

        // Verificar estudiante
        if (this.validateMatricula(cleanCreds)) {
            return this.handleStudentLogin(cleanCreds);
        }

        // Verificar admin
        if (this.validateAdmin(cleanCreds)) {
            return this.handleAdminLogin();
        }

        throw new Error('Credenciales inválidas');
    }

    // Login estudiante
    handleStudentLogin(matricula) {
        let student = window.DataManager.getStudent(matricula);
        
        if (!student) {
            student = {
                matricula: matricula,
                nombre: '',
                carrera: 'Medicina',
                grupo: '',
                activo: true
            };
            window.DataManager.createStudent(student);
        }

        this.currentUser = matricula;
        this.userType = 'student';
        this.saveSession();

        return {
            success: true,
            type: 'student',
            user: student,
            message: 'Bienvenido estudiante'
        };
    }

    // Login admin
    handleAdminLogin() {
        this.currentUser = 'admin';
        this.userType = 'admin';
        this.saveSession();

        return {
            success: true,
            type: 'admin', 
            user: { nombre: 'Administrador' },
            message: 'Acceso administrativo'
        };
    }

    // Guardar sesión
    saveSession() {
        const sessionData = {
            user: this.currentUser,
            type: this.userType,
            timestamp: Date.now()
        };
        localStorage.setItem('hpjrm_session', JSON.stringify(sessionData));
    }

    // Restaurar sesión
    restoreSession() {
        try {
            const sessionData = localStorage.getItem('hpjrm_session');
            if (!sessionData) return false;

            const session = JSON.parse(sessionData);
            this.currentUser = session.user;
            this.userType = session.type;
            return true;
        } catch (error) {
            return false;
        }
    }

    // Cerrar sesión
    logout() {
        this.currentUser = null;
        this.userType = null;
        localStorage.removeItem('hpjrm_session');
        window.UIManager.showScreen('login-screen');
    }

    // Verificar si está logueado
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Obtener usuario actual
    getCurrentUser() {
        if (!this.isLoggedIn()) return null;

        if (this.userType === 'student') {
            const student = window.DataManager.getStudent(this.currentUser);
            return {
                type: 'student',
                matricula: this.currentUser,
                nombre: student?.nombre || 'Estudiante'
            };
        }

        return {
            type: 'admin',
            nombre: 'Administrador'
        };
    }

    // Configurar eventos
    setupEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => {
            this.handleLoginForm();
        });

        document.getElementById('login-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLoginForm();
        });

        document.getElementById('student-logout').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('admin-logout').addEventListener('click', () => {
            this.logout();
        });
    }

    // Manejar formulario de login
    async handleLoginForm() {
        const loginInput = document.getElementById('login-input');
        const loginBtn = document.getElementById('login-btn');
        const credentials = loginInput.value.trim();

        if (!credentials) {
            this.showAlert('Ingrese sus credenciales', 'error');
            return;
        }

        try {
            loginBtn.innerHTML = 'Verificando...';
            loginBtn.disabled = true;

            const result = await this.login(credentials);
            
            if (result.success) {
                this.showAlert(result.message, 'success');
                setTimeout(() => {
                    if (result.type === 'student') {
                        window.UIManager.showScreen('student-dashboard');
                    } else {
                        window.UIManager.showScreen('admin-dashboard');
                    }
                }, 1000);
            }
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
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
        
        setTimeout(() => {
            alertElement.classList.add('hidden');
        }, 5000);
    }

    // Verificar estado de autenticación
    checkAuthStatus() {
        if (this.restoreSession() && this.isLoggedIn()) {
            const user = this.getCurrentUser();
            if (user.type === 'student') {
                window.UIManager.showScreen('student-dashboard');
            } else {
                window.UIManager.showScreen('admin-dashboard');
            }
        }
    }
}

// Crear instancia global
window.AuthManager = AuthManager;
window.authManager = new AuthManager();
