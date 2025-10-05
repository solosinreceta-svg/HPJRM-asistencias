// =============================================
// GESTIÓN DE UI - VERSIÓN SIMPLIFICADA
// =============================================

class DashboardManager {
    constructor() {
        this.currentScreen = 'login-screen';
        this.init();
    }

    init() {
        console.log('📊 DashboardManager inicializado');
        this.setupEventListeners();
    }

    // Mostrar pantalla
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            this.updateScreenData(screenId);
        }
    }

    // Actualizar datos de pantalla
    updateScreenData(screenId) {
        switch(screenId) {
            case 'student-dashboard':
                this.updateStudentDashboard();
                break;
            case 'admin-dashboard':
                this.updateAdminDashboard();
                break;
        }
    }

    // Dashboard estudiante
    updateStudentDashboard() {
        const user = window.authManager.getCurrentUser();
        if (!user || user.type !== 'student') return;

        this.updateStudentProfile(user);
        this.updateStudentAttendanceHistory(user.matricula);
    }

    updateStudentProfile(user) {
        const student = window.dataManager.getStudent(user.matricula);
        if (student) {
            document.getElementById('student-name').textContent = student.nombre || 'Estudiante';
            
            const fullnameInput = document.getElementById('student-fullname');
            const groupInput = document.getElementById('student-group');
            
            if (fullnameInput && student.nombre) {
                fullnameInput.value = student.nombre;
            }
            if (groupInput && student.grupo) {
                groupInput.value = student.grupo;
            }
        }
    }

    updateStudentAttendanceHistory(matricula) {
        const historyContainer = document.getElementById('attendance-history');
        if (!historyContainer) return;

        const attendances = window.dataManager.getAttendancesByStudent(matricula);
        const sortedAttendances = attendances.sort((a, b) => 
            b.asistencia.timestamp - a.asistencia.timestamp
        );

        if (sortedAttendances.length === 0) {
            historyContainer.innerHTML = '<p class="text-center">No hay registros de asistencia</p>';
            return;
        }

        let html = '';
        sortedAttendances.forEach(attendance => {
            const typeIcon = attendance.asistencia.tipo === 'entry' ? '🏥' : '🚪';
            const typeClass = attendance.asistencia.tipo === 'entry' ? 'entry' : 'exit';
            
            html += `
                <div class="attendance-item">
                    <div class="attendance-info">
                        <div class="attendance-date">${attendance.asistencia.fecha}</div>
                        <div class="attendance-time">
                            ${typeIcon} ${attendance.asistencia.hora} - 
                            <span class="attendance-type ${typeClass}">
                                ${attendance.asistencia.tipo === 'entry' ? 'Entrada' : 'Salida'}
                            </span>
                        </div>
                    </div>
                    <span class="attendance-status valid">
                        Válida
                    </span>
                </div>
            `;
        });

        historyContainer.innerHTML = html;
    }

    // Dashboard admin
    updateAdminDashboard() {
        this.updateAdminMetrics();
        this.updateStudentsTable();
    }

    updateAdminMetrics() {
        const stats = window.dataManager.getStats();
        
        document.getElementById('metric-total-students').textContent = stats.totalStudents;
        document.getElementById('metric-inside-hospital').textContent = '0';
        document.getElementById('metric-entries-today').textContent = '0';
        document.getElementById('metric-total-records').textContent = stats.totalAttendances;
    }

    updateStudentsTable() {
        const tableBody = document.getElementById('students-table-body');
        if (!tableBody) return;

        const students = window.dataManager.getAllStudents();
        
        if (students.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay estudiantes</td></tr>';
            return;
        }

        let html = '';
        students.forEach(student => {
            html += `
                <tr>
                    <td>${student.matricula}</td>
                    <td>${student.nombre || 'Sin nombre'}</td>
                    <td>${student.grupo || 'Sin grupo'}</td>
                    <td>
                        <span class="badge ${student.activo ? 'badge-success' : 'badge-danger'}">
                            ${student.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-action edit-student" data-matricula="${student.matricula}">
                            ✏️
                        </button>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    // Configurar eventos
    setupEventListeners() {
        // Tabs admin
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                document.querySelectorAll('.admin-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tabName}`).classList.add('active');
            });
        });

        // Botones escáner
        document.getElementById('scan-entry-btn')?.addEventListener('click', () => {
            this.showScreen('scanner-screen');
        });

        document.getElementById('scan-exit-btn')?.addEventListener('click', () => {
            this.showScreen('scanner-screen');
        });

        // Formularios
        document.getElementById('student-profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStudentProfileSubmit();
        });

        // Cerrar escáner
        document.getElementById('close-scanner-btn')?.addEventListener('click', () => {
            this.showScreen('student-dashboard');
        });

        // Resultados
        document.getElementById('result-ok-btn')?.addEventListener('click', () => {
            this.showScreen('student-dashboard');
        });

        document.getElementById('result-scan-again-btn')?.addEventListener('click', () => {
            this.showScreen('scanner-screen');
        });
    }

    // Manejar perfil estudiante
    handleStudentProfileSubmit() {
        const user = window.authManager.getCurrentUser();
        if (!user || user.type !== 'student') return;

        const fullname = document.getElementById('student-fullname').value.trim();
        const group = document.getElementById('student-group').value.trim();

        if (!fullname) {
            this.showAlert('Ingrese su nombre completo', 'error');
            return;
        }

        try {
            window.dataManager.updateStudent(user.matricula, {
                nombre: fullname,
                grupo: group
            });

            this.showAlert('Perfil actualizado', 'success');
            this.updateStudentDashboard();

        } catch (error) {
            this.showAlert('Error actualizando perfil', 'error');
        }
    }

    // Mostrar resultado de asistencia
    showAttendanceResult(result) {
        this.showScreen('result-screen');
        
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');

        if (result.success) {
            resultIcon.className = 'result-icon result-success';
            resultIcon.textContent = '✅';
            resultTitle.textContent = 'Registro Exitoso';
            resultMessage.textContent = result.message;
        } else {
            resultIcon.className = 'result-icon result-error';
            resultIcon.textContent = '❌';
            resultTitle.textContent = 'Error';
            resultMessage.textContent = result.error || 'Error desconocido';
        }
    }

    // Mostrar alertas
    showAlert(message, type = 'info') {
        // Buscar o crear contenedor de alertas
        let alertContainer = document.getElementById('global-alert-container');
        
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'global-alert-container';
            alertContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(alertContainer);
        }

        const alertId = 'alert-' + Date.now();
        const alertHTML = `
            <div id="${alertId}" class="alert alert-${type}">
                ${message}
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHTML);
        
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                alertElement.remove();
            }
        }, 5000);
    }
}

// Crear instancia global
window.DashboardManager = DashboardManager;
window.UIManager = new DashboardManager();
