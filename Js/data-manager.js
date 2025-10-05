// =============================================
// SISTEMA DE GESTIÓN Y ALMACENAMIENTO DE DATOS
// =============================================

class DataManager {
    constructor() {
        this.storageKeys = {
            STUDENTS: 'hpjrm_students',
            ATTENDANCES: 'hpjrm_attendances',
            SETTINGS: 'hpjrm_settings',
            SESSION: 'hpjrm_session',
            BACKUP: 'hpjrm_backup'
        };
        
        this.init();
    }

    init() {
        this.initializeData();
        this.setupAutoBackup();
        this.setupDataCleanup();
    }

    // ========== INICIALIZACIÓN DE DATOS ==========

    initializeData() {
        // Verificar si existen datos, si no, inicializar con datos de demo
        if (!this.getAllStudents().length) {
            this.initializeDemoData();
        }
        
        // Cargar configuración por defecto si no existe
        if (!this.getSettings()) {
            this.saveSettings({
                hospitalLat: 22.930857,
                hospitalLng: -82.689359,
                gpsRadius: 500,
                qrContent: 'HPJRM',
                adminEmail: '',
                autoCleanup: true,
                cleanupDays: 30,
                autoBackup: true
            });
        }
    }

    initializeDemoData() {
        console.log('Inicializando datos de demostración...');
        
        // Estudiantes de ejemplo
        const demoStudents = [
            {
                matricula: '20251234',
                nombre: 'Ana García López',
                carrera: 'Medicina',
                grupo: 'Grupo A',
                activo: true,
                fechaRegistro: new Date().toISOString(),
                telefono: '',
                email: ''
            },
            {
                matricula: '20255678',
                nombre: 'Carlos Rodríguez Pérez',
                carrera: 'Medicina',
                grupo: 'Grupo B',
                activo: true,
                fechaRegistro: new Date().toISOString(),
                telefono: '',
                email: ''
            },
            {
                matricula: '20259876',
                nombre: 'María Fernández Castro',
                carrera: 'Medicina',
                grupo: 'Grupo A',
                activo: true,
                fechaRegistro: new Date().toISOString(),
                telefono: '',
                email: ''
            }
        ];
        
        demoStudents.forEach(student => {
            this.createStudent(student);
        });

        // Asistencias de ejemplo (últimos 7 días)
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            demoStudents.forEach((student, index) => {
                if (Math.random() > 0.3) { // 70% de probabilidad de asistencia
                    this.createAttendance({
                        id: `att_${date.getTime()}_${student.matricula}_entry`,
                        estudiante: {
                            matricula: student.matricula,
                            nombre: student.nombre
                        },
                        asistencia: {
                            tipo: 'entry',
                            fecha: date.toLocaleDateString('es-ES'),
                            hora: this.generateRandomTime(7, 9), // Entre 7-9 AM
                            latitud: 22.930857,
                            longitud: -82.689359,
                            distancia: Math.floor(Math.random() * 50),
                            timestamp: date.setHours(8, 0, 0, 0),
                            qr_data: 'HPJRM',
                            valido: true,
                            metodo: 'qr'
                        }
                    });

                    // Salida (80% de probabilidad)
                    if (Math.random() > 0.2) {
                        this.createAttendance({
                            id: `att_${date.getTime()}_${student.matricula}_exit`,
                            estudiante: {
                                matricula: student.matricula,
                                nombre: student.nombre
                            },
                            asistencia: {
                                tipo: 'exit',
                                fecha: date.toLocaleDateString('es-ES'),
                                hora: this.generateRandomTime(14, 17), // Entre 2-5 PM
                                latitud: 22.930857,
                                longitud: -82.689359,
                                distancia: Math.floor(Math.random() * 50),
                                timestamp: date.setHours(16, 0, 0, 0),
                                qr_data: 'HPJRM',
                                valido: true,
                                metodo: 'qr'
                            }
                        });
                    }
                }
            });
        }
        
        console.log('Datos de demostración inicializados');
    }

    generateRandomTime(startHour, endHour) {
        const hour = Math.floor(Math.random() * (endHour - startHour)) + startHour;
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);
        
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
    }

    // ========== OPERACIONES PARA ESTUDIANTES ==========

    getAllStudents() {
        try {
            const studentsJSON = localStorage.getItem(this.storageKeys.STUDENTS);
            return studentsJSON ? JSON.parse(studentsJSON) : [];
        } catch (error) {
            console.error('Error obteniendo estudiantes:', error);
            return [];
        }
    }

    getStudent(matricula) {
        const students = this.getAllStudents();
        return students.find(s => s.matricula === matricula) || null;
    }

    createStudent(studentData) {
        try {
            const students = this.getAllStudents();
            
            // Validar datos del estudiante
            if (!this.validateStudentData(studentData)) {
                throw new Error('Datos del estudiante inválidos');
            }
            
            // Verificar si ya existe
            if (this.getStudent(studentData.matricula)) {
                throw new Error('El estudiante ya existe');
            }
            
            // Agregar timestamp
            studentData.fechaRegistro = studentData.fechaRegistro || new Date().toISOString();
            studentData.activo = studentData.activo !== undefined ? studentData.activo : true;
            
            students.push(studentData);
            localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(students));
            
            // Emitir evento
            this.emitDataEvent('studentCreated', studentData);
            
            return true;
        } catch (error) {
            console.error('Error creando estudiante:', error);
            throw error;
        }
    }

    updateStudent(matricula, studentData) {
        try {
            const students = this.getAllStudents();
            const index = students.findIndex(s => s.matricula === matricula);
            
            if (index === -1) {
                throw new Error('Estudiante no encontrado');
            }
            
            // Validar datos
            if (!this.validateStudentData({...students[index], ...studentData})) {
                throw new Error('Datos del estudiante inválidos');
            }
            
            // Mantener la matrícula original y datos del sistema
            studentData.matricula = matricula;
            studentData.fechaRegistro = students[index].fechaRegistro;
            
            students[index] = { ...students[index], ...studentData };
            localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(students));
            
            // Emitir evento
            this.emitDataEvent('studentUpdated', students[index]);
            
            return true;
        } catch (error) {
            console.error('Error actualizando estudiante:', error);
            throw error;
        }
    }

    deleteStudent(matricula) {
        try {
            const students = this.getAllStudents();
            const filteredStudents = students.filter(s => s.matricula !== matricula);
            
            if (filteredStudents.length === students.length) {
                throw new Error('Estudiante no encontrado');
            }
            
            localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(filteredStudents));
            
            // Emitir evento
            this.emitDataEvent('studentDeleted', { matricula });
            
            return true;
        } catch (error) {
            console.error('Error eliminando estudiante:', error);
            throw error;
        }
    }

    validateStudentData(studentData) {
        if (!studentData.matricula || !/^2025\d{4}$/.test(studentData.matricula)) {
            return false;
        }
        
        if (studentData.nombre && studentData.nombre.length > 100) {
            return false;
        }
        
        return true;
    }

    // ========== OPERACIONES PARA ASISTENCIAS ==========

    getAllAttendances() {
        try {
            const attendancesJSON = localStorage.getItem(this.storageKeys.ATTENDANCES);
            return attendancesJSON ? JSON.parse(attendancesJSON) : [];
        } catch (error) {
            console.error('Error obteniendo asistencias:', error);
            return [];
        }
    }

    getAttendancesByStudent(matricula) {
        const allAttendances = this.getAllAttendances();
        return allAttendances.filter(a => a.estudiante.matricula === matricula);
    }

    getAttendancesByDate(dateString) {
        const allAttendances = this.getAllAttendances();
        return allAttendances.filter(a => a.asistencia.fecha === dateString);
    }

    getAttendancesByWeek(startDate, endDate) {
        const allAttendances = this.getAllAttendances();
        return allAttendances.filter(a => {
            const attendanceDate = new Date(a.asistencia.timestamp);
            return attendanceDate >= startDate && attendanceDate <= endDate;
        });
    }

    getTodayAttendances() {
        const today = new Date().toLocaleDateString('es-ES');
        return this.getAttendancesByDate(today);
    }

    getStudentsInsideHospital() {
        const today = new Date().toLocaleDateString('es-ES');
        const todayAttendances = this.getAttendancesByDate(today);
        
        const entries = todayAttendances.filter(a => a.asistencia.tipo === 'entry');
        const exits = todayAttendances.filter(a => a.asistencia.tipo === 'exit');
        
        // Estudiantes que han entrado pero no han salido
        return entries.filter(entry => 
            !exits.some(exit => 
                exit.estudiante.matricula === entry.estudiante.matricula
            )
        );
    }

    async recordAttendance(attendanceData) {
        try {
            const {
                studentMatricula,
                qrData,
                location,
                scanType,
                timestamp,
                method = 'qr'
            } = attendanceData;

            // Verificar estudiante
            const student = this.getStudent(studentMatricula);
            if (!student) {
                throw new Error('Estudiante no encontrado');
            }

            if (!student.activo) {
                throw new Error('Estudiante desactivado');
            }

            // Verificar QR
            const qrValido = qrData === 'HPJRM';
            
            // Verificar ubicación
            const verification = geolocationManager.isWithinHospitalRadius(location);
            const ubicacionValida = verification.valid;

            // Crear registro
            const attendanceRecord = {
                id: `att_${timestamp}_${studentMatricula}_${scanType}_${Math.random().toString(36).substr(2, 9)}`,
                estudiante: {
                    matricula: student.matricula,
                    nombre: student.nombre
                },
                asistencia: {
                    tipo: scanType,
                    fecha: new Date(timestamp).toLocaleDateString('es-ES'),
                    hora: new Date(timestamp).toLocaleTimeString('es-ES'),
                    latitud: location.lat,
                    longitud: location.lng,
                    distancia: verification.distance,
                    accuracy: location.accuracy,
                    timestamp: timestamp,
                    qr_data: qrData,
                    valido: qrValido && ubicacionValida,
                    metodo: method,
                    motivo_invalido: !(qrValido && ubicacionValida) ? 
                        `${!qrValido ? 'QR inválido' : ''}${!qrValido && !ubicacionValida ? ' y ' : ''}${!ubicacionValida ? 'Ubicación inválida' : ''}` : ''
                }
            };

            // Guardar registro
            this.createAttendance(attendanceRecord);

            // Emitir evento
            this.emitDataEvent('attendanceRecorded', attendanceRecord);

            return {
                success: true,
                record: attendanceRecord,
                valid: attendanceRecord.asistencia.valido,
                message: attendanceRecord.asistencia.valido ? 
                    `Registro de ${scanType === 'entry' ? 'entrada' : 'salida'} exitoso` :
                    'Registro completado pero marcado como inválido'
            };

        } catch (error) {
            console.error('Error registrando asistencia:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    createAttendance(attendanceData) {
        try {
            const attendances = this.getAllAttendances();
            
            // Verificar si ya existe
            if (attendances.find(a => a.id === attendanceData.id)) {
                throw new Error('El registro de asistencia ya existe');
            }
            
            attendances.push(attendanceData);
            localStorage.setItem(this.storageKeys.ATTENDANCES, JSON.stringify(attendances));
            
            return true;
        } catch (error) {
            console.error('Error creando asistencia:', error);
            throw error;
        }
    }

    // ========== OPERACIONES PARA CONFIGURACIÓN ==========

    getSettings() {
        try {
            const settingsJSON = localStorage.getItem(this.storageKeys.SETTINGS);
            return settingsJSON ? JSON.parse(settingsJSON) : null;
        } catch (error) {
            console.error('Error obteniendo configuración:', error);
            return null;
        }
    }

    saveSettings(settings) {
        try {
            localStorage.setItem(this.storageKeys.SETTINGS, JSON.stringify(settings));
            
            // Actualizar módulos dependientes
            if (geolocationManager) {
                geolocationManager.updateLocationSettings(settings);
            }
            
            // Emitir evento
            this.emitDataEvent('settingsUpdated', settings);
            
            return true;
        } catch (error) {
            console.error('Error guardando configuración:', error);
            throw error;
        }
    }

    // ========== OPERACIONES DE EXPORTACIÓN ==========

    exportToCSV(dataType, filters = {}) {
        try {
            let data = [];
            let filename = '';
            let headers = [];

            if (dataType === 'students') {
                data = this.getAllStudents();
                filename = `estudiantes_hpjrm_${this.getFormattedDate()}.csv`;
                headers = ['Matrícula', 'Nombre', 'Carrera', 'Grupo', 'Activo', 'Fecha Registro'];
            } else if (dataType === 'attendances') {
                data = this.getFilteredAttendances(filters);
                filename = `asistencias_hpjrm_${this.getFormattedDate()}.csv`;
                headers = ['ID', 'Matrícula', 'Nombre', 'Tipo', 'Fecha', 'Hora', 'Latitud', 'Longitud', 'Distancia', 'Método', 'Válido', 'Motivo Inválido'];
            } else if (dataType === 'weekly') {
                data = this.getWeeklyReport(filters.week);
                filename = `reporte_semanal_hpjrm_${filters.week || this.getFormattedDate()}.csv`;
                headers = ['Matrícula', 'Nombre', 'Grupo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Total Horas'];
            }

            if (data.length === 0) {
                throw new Error('No hay datos para exportar');
            }

            // Crear contenido CSV
            let csvContent = '\uFEFF'; // BOM para UTF-8
            csvContent += headers.join(',') + '\n';

            data.forEach(item => {
                let row = [];

                if (dataType === 'students') {
                    row = [
                        `"${item.matricula}"`,
                        `"${item.nombre}"`,
                        `"${item.carrera}"`,
                        `"${item.grupo}"`,
                        `"${item.activo ? 'Sí' : 'No'}"`,
                        `"${item.fechaRegistro}"`
                    ];
                } else if (dataType === 'attendances') {
                    row = [
                        `"${item.id}"`,
                        `"${item.estudiante.matricula}"`,
                        `"${item.estudiante.nombre}"`,
                        `"${item.asistencia.tipo}"`,
                        `"${item.asistencia.fecha}"`,
                        `"${item.asistencia.hora}"`,
                        `"${item.asistencia.latitud}"`,
                        `"${item.asistencia.longitud}"`,
                        `"${item.asistencia.distancia}"`,
                        `"${item.asistencia.metodo}"`,
                        `"${item.asistencia.valido ? 'Sí' : 'No'}"`,
                        `"${item.asistencia.motivo_invalido || ''}"`
                    ];
                } else if (dataType === 'weekly') {
                    row = [
                        `"${item.matricula}"`,
                        `"${item.nombre}"`,
                        `"${item.grupo}"`,
                        ...item.semana.map(day => `"${day}"`),
                        `"${item.totalHoras}"`
                    ];
                }

                csvContent += row.join(',') + '\n';
            });

            return {
                content: csvContent,
                filename: filename,
                type: 'text/csv;charset=utf-8;'
            };
        } catch (error) {
            console.error('Error exportando a CSV:', error);
            throw error;
        }
    }

    exportToJSON(dataType) {
        try {
            let data = {};
            let filename = '';

            if (dataType === 'students') {
                data = this.getAllStudents();
                filename = `estudiantes_hpjrm_${this.getFormattedDate()}.json`;
            } else if (dataType === 'attendances') {
                data = this.getAllAttendances();
                filename = `asistencias_hpjrm_${this.getFormattedDate()}.json`;
            } else if (dataType === 'all') {
                data = {
                    students: this.getAllStudents(),
                    attendances: this.getAllAttendances(),
                    settings: this.getSettings(),
                    exportDate: new Date().toISOString(),
                    version: '1.0'
                };
                filename = `backup_completo_hpjrm_${this.getFormattedDate()}.json`;
            }

            return {
                content: JSON.stringify(data, null, 2),
                filename: filename,
                type: 'application/json'
            };
        } catch (error) {
            console.error('Error exportando a JSON:', error);
            throw error;
        }
    }

    // ========== REPORTES SEMANALES ==========

    getWeeklyReport(weekString = null) {
        const startDate = weekString ? 
            new Date(weekString + 'T00:00:00') : 
            this.getStartOfWeek(new Date());
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        
        const weekAttendances = this.getAttendancesByWeek(startDate, endDate);
        const students = this.getAllStudents().filter(s => s.activo);
        
        const report = students.map(student => {
            const studentAttendances = weekAttendances.filter(a => 
                a.estudiante.matricula === student.matricula && a.asistencia.valido
            );
            
            const weekDays = this.getWeekDays(startDate);
            const dailyStatus = weekDays.map(day => {
                const dayAttendances = studentAttendances.filter(a => 
                    a.asistencia.fecha === day.toLocaleDateString('es-ES')
                );
                
                if (dayAttendances.length === 0) return 'Falta';
                
                const entry = dayAttendances.find(a => a.asistencia.tipo === 'entry');
                const exit = dayAttendances.find(a => a.asistencia.tipo === 'exit');
                
                if (entry && exit) {
                    const hours = this.calculateStayTime(entry, exit);
                    return `${hours}h`;
                } else if (entry) {
                    return 'Entrada';
                } else {
                    return 'Salida';
                }
            });
            
            const totalHours = this.calculateWeeklyHours(studentAttendances);
            
            return {
                matricula: student.matricula,
                nombre: student.nombre,
                grupo: student.grupo,
                semana: dailyStatus,
                totalHoras: totalHours + 'h'
            };
        });
        
        return report;
    }

    getWeekDays(startDate) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        return days;
    }

    calculateStayTime(entry, exit) {
        const entryTime = new Date(entry.asistencia.timestamp);
        const exitTime = new Date(exit.asistencia.timestamp);
        const hours = (exitTime - entryTime) / (1000 * 60 * 60);
        return Math.round(hours * 10) / 10; // Redondear a 1 decimal
    }

    calculateWeeklyHours(attendances) {
        let totalMinutes = 0;
        
        for (let i = 0; i < attendances.length; i += 2) {
            const entry = attendances[i];
            const exit = attendances[i + 1];
            
            if (entry && exit && entry.asistencia.tipo === 'entry' && exit.asistencia.tipo === 'exit') {
                const entryTime = new Date(entry.asistencia.timestamp);
                const exitTime = new Date(exit.asistencia.timestamp);
                totalMinutes += (exitTime - entryTime) / (1000 * 60);
            }
        }
        
        return Math.round(totalMinutes / 60 * 10) / 10;
    }

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // ========== UTILIDADES ==========

    getFormattedDate() {
        return new Date().toISOString().slice(0, 10).replace(/-/g, '');
    }

    getFilteredAttendances(filters) {
        let attendances = this.getAllAttendances();
        
        if (filters.student) {
            attendances = attendances.filter(a => a.estudiante.matricula === filters.student);
        }
        
        if (filters.date) {
            attendances = attendances.filter(a => a.asistencia.fecha === filters.date);
        }
        
        if (filters.type) {
            attendances = attendances.filter(a => a.asistencia.tipo === filters.type);
        }
        
        if (filters.valid !== undefined) {
            attendances = attendances.filter(a => a.asistencia.valido === filters.valid);
        }
        
        return attendances;
    }

    // ========== BACKUP Y RESTAURACIÓN ==========

    createBackup() {
        try {
            const backup = {
                students: this.getAllStudents(),
                attendances: this.getAllAttendances(),
                settings: this.getSettings(),
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            localStorage.setItem(this.storageKeys.BACKUP, JSON.stringify(backup));
            
            return backup;
        } catch (error) {
            console.error('Error creando backup:', error);
            throw error;
        }
    }

    restoreFromBackup(backupData) {
        try {
            const backup = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
            
            if (!backup.students || !backup.attendances) {
                throw new Error('Datos de backup inválidos');
            }
            
            // Restaurar datos
            localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(backup.students));
            localStorage.setItem(this.storageKeys.ATTENDANCES, JSON.stringify(backup.attendances));
            
            if (backup.settings) {
                localStorage.setItem(this.storageKeys.SETTINGS, JSON.stringify(backup.settings));
            }
            
            this.emitDataEvent('dataRestored', backup);
            
            return true;
        } catch (error) {
            console.error('Error restaurando backup:', error);
            throw error;
        }
    }

    // ========== LIMPIEZA AUTOMÁTICA ==========

    setupAutoBackup() {
        // Hacer backup automático cada 24 horas
        setInterval(() => {
            const settings = this.getSettings();
            if (settings && settings.autoBackup) {
                this.createBackup();
                console.log('Backup automático completado');
            }
        }, 24 * 60 * 60 * 1000);
    }

    setupDataCleanup() {
        // Limpiar datos antiguos cada 24 horas
        setInterval(() => {
            const settings = this.getSettings();
            if (settings && settings.autoCleanup) {
                this.cleanOldData(settings.cleanupDays || 30);
            }
        }, 24 * 60 * 60 * 1000);
    }

    cleanOldData(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const attendances = this.getAllAttendances();
            const recentAttendances = attendances.filter(a => 
                new Date(a.asistencia.timestamp) >= cutoffDate
            );
            
            if (recentAttendances.length < attendances.length) {
                localStorage.setItem(this.storageKeys.ATTENDANCES, JSON.stringify(recentAttendances));
                console.log(`Limpieza completada: ${attendances.length - recentAttendances.length} registros eliminados`);
            }
            
            return attendances.length - recentAttendances.length;
        } catch (error) {
            console.error('Error en limpieza de datos:', error);
            return 0;
        }
    }

    clearAllData() {
        try {
            localStorage.removeItem(this.storageKeys.STUDENTS);
            localStorage.removeItem(this.storageKeys.ATTENDANCES);
            localStorage.removeItem(this.storageKeys.SETTINGS);
            localStorage.removeItem(this.storageKeys.SESSION);
            
            // Reinicializar con datos de demo
            this.initializeData();
            
            this.emitDataEvent('dataCleared');
            
            return true;
        } catch (error) {
            console.error('Error limpiando datos:', error);
            throw error;
        }
    }

    // ========== EVENTOS ==========

    emitDataEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                manager: this,
                ...detail
            }
        });
        document.dispatchEvent(event);
    }

    // ========== ESTADÍSTICAS ==========

    getStats() {
        const students = this.getAllStudents();
        const attendances = this.getAllAttendances();
        const todayAttendances = this.getTodayAttendances();
        const studentsInside = this.getStudentsInsideHospital();
        
        const activeStudents = students.filter(s => s.activo).length;
        const validAttendances = attendances.filter(a => a.asistencia.valido).length;
        const todayEntries = todayAttendances.filter(a => a.asistencia.tipo === 'entry' && a.asistencia.valido).length;
        const todayExits = todayAttendances.filter(a => a.asistencia.tipo === 'exit' && a.asistencia.valido).length;
        
        return {
            totalStudents: students.length,
            activeStudents: activeStudents,
            totalAttendances: attendances.length,
            validAttendances: validAttendances,
            todayEntries: todayEntries,
            todayExits: todayExits,
            studentsInside: studentsInside.length,
            attendanceRate: activeStudents > 0 ? Math.round((validAttendances / activeStudents) * 100) : 0
        };
    }
}

// Crear instancia global
const dataManager = new DataManager();