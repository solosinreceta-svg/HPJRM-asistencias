// =============================================
// GESTIÓN DE DASHBOARDS Y INTERFAZ DE USUARIO
// =============================================

class DashboardManager {
    constructor() {
        this.currentScreen = 'login-screen';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDataListeners();
        this.checkInitialScreen();
    }

    // ========== GESTIÓN DE PANTALLAS ==========

    showScreen(screenId) {
        // Validar pantalla
        const validScreens = [
            'login-screen', 
            'student-dashboard', 
            'admin-dashboard', 
            'scanner-screen', 
            'result-screen'
        ];
        
        if (!validScreens.includes(screenId)) {
            console.error('Pantalla no válida:', screenId);
            return;
        }

        // Ocultar todas las pantallas
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Mostrar pantalla solicitada
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            
            // Actualizar datos específicos de la pantalla
            this.updateScreenData(screenId);
            
            // Emitir evento
            this.emitScreenEvent('screenChanged', screenId);
            
            console.log('Pantalla cambiada a:', screenId);
        }
    }

    updateScreenData(screenId) {
        switch(screenId) {
            case 'student-dashboard':
                this.updateStudentDashboard();
                break;
            case 'admin-dashboard':
                this.updateAdminDashboard();
                break;
            case 'scanner-screen':
                // El escáner se maneja por separado
                break;
            case 'result-screen':
                // Los resultados se manejan por separado
                break;
        }
    }

    checkInitialScreen() {
        if (authManager.isLoggedIn()) {
            const user = authManager.getCurrentUser();
            if (user.type === 'student') {
                this.showScreen('student-dashboard');
            } else if (user.type === 'admin') {
                this.showScreen('admin-dashboard');
            }
        } else {
            this.showScreen('login-screen');
        }
    }

    // ========== DASHBOARD ESTUDIANTE ==========

    updateStudentDashboard() {
        const user = authManager.getCurrentUser();
        if (!user || user.type !== 'student') return;

        this.updateStudentProfile(user);
        this.updateStudentAttendanceHistory(user.matricula);
        this.updateStudentStats(user.matricula);
    }

    updateStudentProfile(user) {
        const student = dataManager.getStudent(user.matricula);
        
        if (student) {
            // Actualizar nombre en el header
            const studentNameElement = document.getElementById('student-name');
            if (studentNameElement) {
                studentNameElement.textContent = student.nombre || 'Estudiante';
            }

            // Actualizar formulario de perfil
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

        const attendances = dataManager.getAttendancesByStudent(matricula);
        const sortedAttendances = attendances.sort((a, b) => 
            b.asistencia.timestamp - a.asistencia.timestamp
        ).slice(0, 20); // Mostrar solo los últimos 20 registros

        if (sortedAttendances.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h4>No hay registros de asistencia</h4>
                    <p>Utiliza el escáner QR para registrar tu entrada y salida</p>
                </div>
            `;
            return;
        }

        let html = '';
        sortedAttendances.forEach(attendance => {
            const typeIcon = attendance.asistencia.tipo === 'entry' ? '🏥' : '🚪';
            const typeClass = attendance.asistencia.tipo === 'entry' ? 'entry' : 'exit';
            const statusClass = attendance.asistencia.valido ? 'valid' : 'invalid';
            const statusText = attendance.asistencia.valido ? 'Válida' : 'Inválida';
            
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
                        <div class="location-details">
                            ${attendance.asistencia.metodo === 'manual' ? '📝 Manual' : '📷 QR'} • 
                            ${attendance.asistencia.distancia}m del hospital
                        </div>
                    </div>
                    <span class="attendance-status ${statusClass}">
                        ${statusText}
                    </span>
                </div>
            `;
        });

        historyContainer.innerHTML = html;
    }

    updateStudentStats(matricula) {
        const attendances = dataManager.getAttendancesByStudent(matricula);
        const validAttendances = attendances.filter(a => a.asistencia.valido);
        const entries = validAttendances.filter(a => a.asistencia.tipo === 'entry');
        const exits = validAttendances.filter(a => a.asistencia.tipo === 'exit');
        
        // Podrías mostrar estas estadísticas en el dashboard del estudiante
        console.log(`Estadísticas estudiante ${matricula}:`, {
            totalRegistros: attendances.length,
            registrosValidos: validAttendances.length,
            entradas: entries.length,
            salidas: exits.length
        });
    }

    // ========== DASHBOARD ADMINISTRATIVO ==========

    updateAdminDashboard() {
        this.updateAdminMetrics();
        this.updateStudentsTable();
        this.updateAttendanceTable();
        this.updateSettingsForm();
    }

    updateAdminMetrics() {
        const stats = dataManager.getStats();
        
        // Actualizar métricas
        document.getElementById('metric-total-students').textContent = stats.totalStudents;
        document.getElementById('metric-inside-hospital').textContent = stats.studentsInside;
        document.getElementById('metric-entries-today').textContent = stats.todayEntries;
        document.getElementById('metric-total-records').textContent = stats.totalAttendances;
        
        // Actualizar porcentaje de asistencia
        const attendancePercentage = document.querySelector('.metric-card.accent .metric-value');
        if (attendancePercentage) {
            attendancePercentage.textContent = `${stats.attendanceRate}%`;
        }
    }

    updateStudentsTable() {
        const tableBody = document.getElementById('students-table-body');
        if (!tableBody) return;

        const students = dataManager.getAllStudents();
        const sortedStudents = students.sort((a, b) => 
            a.matricula.localeCompare(b.matricula)
        );

        if (sortedStudents.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">👥</div>
                            <h4>No hay estudiantes registrados</h4>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        sortedStudents.forEach(student => {
            const attendances = dataManager.getAttendancesByStudent(student.matricula);
            const validAttendances = attendances.filter(a => a.asistencia.valido);
            const todayAttendances = dataManager.getTodayAttendances().filter(a => 
                a.estudiante.matricula === student.matricula
            );
            
            const isInside = dataManager.getStudentsInsideHospital().some(s => 
                s.estudiante.matricula === student.matricula
            );

            html += `
                <tr>
                    <td>
                        <strong>${student.matricula}</strong>
                        ${isInside ? '<span class="badge badge-primary ml-1">En hospital</span>' : ''}
                    </td>
                    <td>${student.nombre || 'Sin nombre'}</td>
                    <td>${student.grupo || 'Sin grupo'}</td>
                    <td>
                        <span class="badge ${student.activo ? 'badge-success' : 'badge-danger'}">
                            ${student.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action edit-student" data-matricula="${student.matricula}" title="Editar">
                                ✏️
                            </button>
                            <button class="btn-action toggle-student" data-matricula="${student.matricula}" data-active="${student.activo}" title="${student.activo ? 'Desactivar' : 'Activar'}">
                                ${student.activo ? '⏸️' : '▶️'}
                            </button>
                            <button class="btn-action view-attendance" data-matricula="${student.matricula}" title="Ver asistencias">
                👁️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
        
        // Configurar event listeners para botones de acción
        this.setupStudentActionListeners();
    }

    updateAttendanceTable() {
        const tableBody = document.getElementById('attendance-table-body');
        if (!tableBody) return;

        const attendances = dataManager.getAllAttendances();
        const sortedAttendances = attendances.sort((a, b) => 
            b.asistencia.timestamp - a.asistencia.timestamp
        ).slice(0, 50); // Mostrar solo los últimos 50 registros

        if (sortedAttendances.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <h4>No hay registros de asistencia</h4>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        sortedAttendances.forEach(attendance => {
            const typeIcon = attendance.asistencia.tipo === 'entry' ? '🏥' : '🚪';
            const methodIcon = attendance.asistencia.metodo === 'manual' ? '📝' : '📷';
            
            html += `
                <tr>
                    <td>${attendance.asistencia.fecha}</td>
                    <td>
                        <strong>${attendance.estudiante.nombre}</strong>
                        <div class="student-id">${attendance.estudiante.matricula}</div>
                    </td>
                    <td>
                        <span class="badge ${attendance.asistencia.tipo === 'entry' ? 'badge-success' : 'badge-accent'}">
                            ${typeIcon} ${attendance.asistencia.tipo === 'entry' ? 'Entrada' : 'Salida'}
                        </span>
                    </td>
                    <td>${attendance.asistencia.hora}</td>
                    <td>
                        ${methodIcon} ${attendance.asistencia.distancia}m
                        <div class="location-details">
                            ${attendance.asistencia.latitud.toFixed(6)}, ${attendance.asistencia.longitud.toFixed(6)}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${attendance.asistencia.valido ? 'badge-success' : 'badge-danger'}">
                            ${attendance.asistencia.valido ? '✅ Válida' : '❌ Inválida'}
                        </span>
                        ${!attendance.asistencia.valido ? 
                            `<div class="error-reason">${attendance.asistencia.motivo_invalido}</div>` : ''
                        }
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    updateSettingsForm() {
        const settings = dataManager.getSettings();
        if (!settings) return;

        document.getElementById('hospital-lat').value = settings.hospitalLat || 22.930857;
        document.getElementById('hospital-lng').value = settings.hospitalLng || -82.689359;
        document.getElementById('gps-radius').value = settings.gpsRadius || 500;
        document.getElementById('admin-email').value = settings.adminEmail || '';
    }

    // ========== CONFIGURACIÓN DE EVENT LISTENERS ==========

    setupEventListeners() {
        // Navegación entre tabs del admin
        this.setupAdminTabs();
        
        // Botones de escaneo del estudiante
        this.setupStudentScanButtons();
        
        // Formularios
        this.setupForms();
        
        // Botones de exportación
        this.setupExportButtons();
    }

    setupAdminTabs() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Actualizar tabs activos
                document.querySelectorAll('.admin-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                // Mostrar contenido del tab
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tabName}`).classList.add('active');
                
                // Actualizar datos específicos del tab
                this.updateTabData(tabName);
            });
        });
    }

    updateTabData(tabName) {
        switch(tabName) {
            case 'students':
                this.updateStudentsTable();
                break;
            case 'attendance':
                this.updateAttendanceTable();
                break;
            case 'reports':
                this.updateReportsTab();
                break;
            case 'settings':
                this.updateSettingsForm();
                break;
        }
    }

    setupStudentScanButtons() {
        // Botón de entrada
        document.getElementById('scan-entry-btn')?.addEventListener('click', () => {
            this.showScreen('scanner-screen');
            // El tipo de escaneo se configura cuando se inicia el escáner
        });

        // Botón de salida
        document.getElementById('scan-exit-btn')?.addEventListener('click', () => {
            this.showScreen('scanner-screen');
            // El tipo de escaneo se configura cuando se inicia el escáner
        });
    }

    setupForms() {
        // Formulario de perfil del estudiante
        document.getElementById('student-profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStudentProfileSubmit();
        });

        // Formulario de configuración
        document.getElementById('settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSettingsSubmit();
        });
    }

    setupExportButtons() {
        // Exportar CSV
        document.getElementById('export-csv-btn')?.addEventListener('click', () => {
            this.exportData('csv');
        });

        // Exportar JSON
        document.getElementById('export-json-btn')?.addEventListener('click', () => {
            this.exportData('json');
        });

        // Backup de datos
        document.getElementById('backup-data-btn')?.addEventListener('click', () => {
            this.createBackup();
        });

        // Limpiar datos antiguos
        document.getElementById('clear-old-btn')?.addEventListener('click', () => {
            this.cleanOldData();
        });

        // Restablecer todos los datos
        document.getElementById('reset-all-btn')?.addEventListener('click', () => {
            this.resetAllData();
        });
    }

    setupStudentActionListeners() {
        // Botones de editar estudiante
        document.querySelectorAll('.edit-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const matricula = btn.dataset.matricula;
                this.editStudent(matricula);
            });
        });

        // Botones de activar/desactivar estudiante
        document.querySelectorAll('.toggle-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const matricula = btn.dataset.matricula;
                const currentlyActive = btn.dataset.active === 'true';
                this.toggleStudentStatus(matricula, !currentlyActive);
            });
        });

        // Botones de ver asistencias
        document.querySelectorAll('.view-attendance').forEach(btn => {
            btn.addEventListener('click', () => {
                const matricula = btn.dataset.matricula;
                this.viewStudentAttendance(matricula);
            });
        });
    }

    setupDataListeners() {
        // Escuchar eventos de datos para actualizar la UI
        document.addEventListener('attendanceRecorded', () => {
            if (this.currentScreen === 'admin-dashboard') {
                this.updateAdminMetrics();
                this.updateAttendanceTable();
            }
        });

        document.addEventListener('studentUpdated', () => {
            if (this.currentScreen === 'admin-dashboard') {
                this.updateAdminMetrics();
                this.updateStudentsTable();
            }
        });

        document.addEventListener('settingsUpdated', () => {
            if (this.currentScreen === 'admin-dashboard') {
                this.updateSettingsForm();
            }
        });
    }

    // ========== MANEJO DE FORMULARIOS ==========

    handleStudentProfileSubmit() {
        const user = authManager.getCurrentUser();
        if (!user || user.type !== 'student') return;

        const fullname = document.getElementById('student-fullname').value.trim();
        const group = document.getElementById('student-group').value.trim();

        if (!fullname) {
            this.showAlert('Por favor ingrese su nombre completo', 'error');
            return;
        }

        try {
            dataManager.updateStudent(user.matricula, {
                nombre: fullname,
                grupo: group
            });

            this.showAlert('Perfil actualizado correctamente', 'success');
            this.updateStudentDashboard();

        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'error');
        }
    }

    handleSettingsSubmit() {
        const settings = {
            hospitalLat: parseFloat(document.getElementById('hospital-lat').value),
            hospitalLng: parseFloat(document.getElementById('hospital-lng').value),
            gpsRadius: parseInt(document.getElementById('gps-radius').value),
            adminEmail: document.getElementById('admin-email').value.trim(),
            autoCleanup: true,
            cleanupDays: 30,
            autoBackup: true
        };

        try {
            dataManager.saveSettings(settings);
            this.showAlert('Configuración guardada correctamente', 'success');
            
            // Actualizar módulo de geolocalización
            if (geolocationManager) {
                geolocationManager.updateLocationSettings(settings);
            }

        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'error');
        }
    }

    // ========== ACCIONES DE ADMINISTRADOR ==========

    editStudent(matricula) {
        const student = dataManager.getStudent(matricula);
        if (!student) return;

        // En una implementación completa, aquí abrirías un modal de edición
        const newName = prompt('Nuevo nombre del estudiante:', student.nombre);
        if (newName !== null) {
            const newGroup = prompt('Nuevo grupo:', student.grupo);
            
            try {
                dataManager.updateStudent(matricula, {
                    nombre: newName.trim(),
                    grupo: newGroup ? newGroup.trim() : student.grupo
                });
                
                this.showAlert('Estudiante actualizado correctamente', 'success');
                this.updateStudentsTable();
                
            } catch (error) {
                this.showAlert(`Error: ${error.message}`, 'error');
            }
        }
    }

    toggleStudentStatus(matricula, active) {
        try {
            authManager.toggleStudentStatus(matricula, active);
            this.showAlert(`Estudiante ${active ? 'activado' : 'desactivado'} correctamente`, 'success');
            this.updateStudentsTable();
            this.updateAdminMetrics();
            
        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'error');
        }
    }

    viewStudentAttendance(matricula) {
        const student = dataManager.getStudent(matricula);
        const attendances = dataManager.getAttendancesByStudent(matricula);
        
        // En una implementación completa, aquí mostrarías un modal con el historial
        alert(`Historial de ${student.nombre} (${matricula}):\n\n` +
              `Total de registros: ${attendances.length}\n` +
              `Registros válidos: ${attendances.filter(a => a.asistencia.valido).length}\n` +
              `Entradas: ${attendances.filter(a => a.asistencia.tipo === 'entry' && a.asistencia.valido).length}\n` +
              `Salidas: ${attendances.filter(a => a.asistencia.tipo === 'exit' && a.asistencia.valido).length}`);
    }

    // ========== EXPORTACIÓN Y BACKUP ==========

    exportData(format) {
        try {
            let exportResult;
            
            if (format === 'csv') {
                exportResult = dataManager.exportToCSV('attendances');
            } else if (format === 'json') {
                exportResult = dataManager.exportToJSON('all');
            }
            
            if (exportResult) {
                this.downloadFile(
                    exportResult.content,
                    exportResult.filename,
                    exportResult.type
                );
                this.showAlert(`Datos exportados como ${format.toUpperCase()}`, 'success');
            }
            
        } catch (error) {
            this.showAlert(`Error exportando datos: ${error.message}`, 'error');
        }
    }

    createBackup() {
        try {
            const backup = dataManager.createBackup();
            this.downloadFile(
                JSON.stringify(backup, null, 2),
                `backup_hpjrm_${new Date().toISOString().slice(0, 10)}.json`,
                'application/json'
            );
            this.showAlert('Backup creado y descargado', 'success');
        } catch (error) {
            this.showAlert(`Error creando backup: ${error.message}`, 'error');
        }
    }

    cleanOldData() {
        try {
            const cleanedCount = dataManager.cleanOldData(30);
            this.showAlert(`${cleanedCount} registros antiguos eliminados`, 'success');
            this.updateAdminMetrics();
            this.updateAttendanceTable();
        } catch (error) {
            this.showAlert(`Error limpiando datos: ${error.message}`, 'error');
        }
    }

    resetAllData() {
        if (confirm('¿ESTÁ SEGURO? Esta acción eliminará TODOS los datos y restaurará los datos de demostración. Esta acción no se puede deshacer.')) {
            try {
                dataManager.clearAllData();
                this.showAlert('Todos los datos han sido restablecidos', 'success');
                this.updateAdminDashboard();
            } catch (error) {
                this.showAlert(`Error restableciendo datos: ${error.message}`, 'error');
            }
        }
    }

    // ========== PESTAÑA DE REPORTES ==========

    updateReportsTab() {
        // Esta función se llamará cuando se active la pestaña de reportes
        console.log('Actualizando pestaña de reportes...');
        // La implementación completa de reportes estará en reports.js
    }

    // ========== UTILIDADES ==========

    showAlert(message, type = 'info') {
        // Buscar contenedor de alertas existente o crear uno nuevo
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
            <div id="${alertId}" class="alert alert-${type} global-alert">
                ${message}
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHTML);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                alertElement.remove();
            }
        }, 5000);
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    emitScreenEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                manager: this,
                screen: this.currentScreen,
                ...detail
            }
        });
        document.dispatchEvent(event);
    }

    // ========== MOSTRAR RESULTADOS DE ASISTENCIA ==========

    showAttendanceResult(result) {
        this.showScreen('result-screen');
        
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const resultStudent = document.getElementById('result-student');
        const resultType = document.getElementById('result-type');
        const resultDatetime = document.getElementById('result-datetime');
        const resultLocation = document.getElementById('result-location');
        const resultDistance = document.getElementById('result-distance');

        if (result.success && result.record) {
            const record = result.record;
            const student = dataManager.getStudent(record.estudiante.matricula);
            
            if (result.valid) {
                resultIcon.className = 'result-icon result-success';
                resultIcon.textContent = '✅';
                resultTitle.textContent = 'Registro Exitoso';
                resultMessage.textContent = `Tu ${record.asistencia.tipo === 'entry' ? 'entrada' : 'salida'} ha sido registrada correctamente`;
            } else {
                resultIcon.className = 'result-icon result-warning';
                resultIcon.textContent = '⚠️';
                resultTitle.textContent = 'Registro con Advertencia';
                resultMessage.textContent = 'Registro completado pero marcado como inválido';
            }
            
            resultStudent.textContent = student?.nombre || record.estudiante.matricula;
            resultType.textContent = record.asistencia.tipo === 'entry' ? 'Entrada' : 'Salida';
            resultDatetime.textContent = `${record.asistencia.fecha} ${record.asistencia.hora}`;
            resultLocation.textContent = `${record.asistencia.latitud.toFixed(6)}, ${record.asistencia.longitud.toFixed(6)}`;
            resultDistance.textContent = `${record.asistencia.distancia}m del hospital`;
            
        } else {
            resultIcon.className = 'result-icon result-error';
            resultIcon.textContent = '❌';
            resultTitle.textContent = 'Error en el Registro';
            resultMessage.textContent = result.error || 'Ha ocurrido un error inesperado';
            
            resultStudent.textContent = '-';
            resultType.textContent = '-';
            resultDatetime.textContent = '-';
            resultLocation.textContent = '-';
            resultDistance.textContent = '-';
        }

        // Configurar botones de resultado
        document.getElementById('result-ok-btn').onclick = () => {
            this.showScreen('student-dashboard');
        };

        document.getElementById('result-scan-again-btn').onclick = () => {
            this.showScreen('scanner-screen');
        };
    }
}

// Estilos para el dashboard
const loadDashboardStyles = () => {
    const styles = `
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 15px;
            opacity: 0.5;
        }
        
        .empty-state h4 {
            margin-bottom: 10px;
            color: #333;
        }
        
        .action-buttons {
            display: flex;
            gap: 5px;
        }
        
        .btn-action {
            background: none;
            border: none;
            padding: 5px;
            cursor: pointer;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        
        .btn-action:hover {
            background-color: #f8f9fa;
        }
        
        .student-id {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
        }
        
        .error-reason {
            font-size: 11px;
            color: #dc3545;
            margin-top: 2px;
        }
        
        .global-alert {
            margin-bottom: 10px;
            animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .ml-1 {
            margin-left: 5px;
        }
        
        .badge-accent {
            background-color: rgba(255, 107, 53, 0.1);
            color: #ff6b35;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos
loadDashboardStyles();

// Crear instancia global
const dashboardManager = new DashboardManager();

// Alias para compatibilidad
const UIManager = dashboardManager;