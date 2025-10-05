// =============================================
// GESTIÓN DE DATOS - VERSIÓN SIMPLIFICADA
// =============================================

class DataManager {
    constructor() {
        this.storageKeys = {
            STUDENTS: 'hpjrm_students',
            ATTENDANCES: 'hpjrm_attendances',
            SETTINGS: 'hpjrm_settings'
        };
        this.init();
    }

    init() {
        console.log('💾 DataManager inicializado');
        this.initializeData();
    }

    // Inicializar datos
    initializeData() {
        if (!this.getAllStudents().length) {
            this.initializeDemoData();
        }
        
        if (!this.getSettings()) {
            this.saveSettings({
                hospitalLat: 22.930857,
                hospitalLng: -82.689359,
                gpsRadius: 500
            });
        }
    }

    // Datos de demostración
    initializeDemoData() {
        const demoStudents = [
            {
                matricula: '20251234',
                nombre: 'Ana García López',
                carrera: 'Medicina',
                grupo: 'Grupo A',
                activo: true
            },
            {
                matricula: '20255678',
                nombre: 'Carlos Rodríguez Pérez', 
                carrera: 'Medicina',
                grupo: 'Grupo B',
                activo: true
            },
            {
                matricula: '20259876',
                nombre: 'María Fernández Castro',
                carrera: 'Medicina', 
                grupo: 'Grupo A',
                activo: true
            }
        ];
        
        demoStudents.forEach(student => {
            this.createStudent(student);
        });
    }

    // Operaciones estudiantes
    getAllStudents() {
        const studentsJSON = localStorage.getItem(this.storageKeys.STUDENTS);
        return studentsJSON ? JSON.parse(studentsJSON) : [];
    }

    getStudent(matricula) {
        const students = this.getAllStudents();
        return students.find(s => s.matricula === matricula) || null;
    }

    createStudent(studentData) {
        const students = this.getAllStudents();
        students.push(studentData);
        localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(students));
        return true;
    }

    updateStudent(matricula, studentData) {
        const students = this.getAllStudents();
        const index = students.findIndex(s => s.matricula === matricula);
        if (index === -1) return false;
        
        students[index] = { ...students[index], ...studentData };
        localStorage.setItem(this.storageKeys.STUDENTS, JSON.stringify(students));
        return true;
    }

    // Operaciones asistencias
    getAllAttendances() {
        const attendancesJSON = localStorage.getItem(this.storageKeys.ATTENDANCES);
        return attendancesJSON ? JSON.parse(attendancesJSON) : [];
    }

    getAttendancesByStudent(matricula) {
        const allAttendances = this.getAllAttendances();
        return allAttendances.filter(a => a.estudiante.matricula === matricula);
    }

    createAttendance(attendanceData) {
        const attendances = this.getAllAttendances();
        attendances.push(attendanceData);
        localStorage.setItem(this.storageKeys.ATTENDANCES, JSON.stringify(attendances));
        return true;
    }

    // Registrar asistencia
    async recordAttendance(attendanceData) {
        const { studentMatricula, qrData, location, scanType } = attendanceData;

        const student = this.getStudent(studentMatricula);
        if (!student) {
            throw new Error('Estudiante no encontrado');
        }

        const attendanceRecord = {
            id: `att_${Date.now()}_${studentMatricula}`,
            estudiante: {
                matricula: student.matricula,
                nombre: student.nombre
            },
            asistencia: {
                tipo: scanType,
                fecha: new Date().toLocaleDateString('es-ES'),
                hora: new Date().toLocaleTimeString('es-ES'),
                latitud: location.lat,
                longitud: location.lng,
                distancia: 0,
                timestamp: Date.now(),
                qr_data: qrData,
                valido: true,
                metodo: 'qr'
            }
        };

        this.createAttendance(attendanceRecord);

        return {
            success: true,
            record: attendanceRecord,
            valid: true,
            message: `Registro de ${scanType} exitoso`
        };
    }

    // Configuración
    getSettings() {
        const settingsJSON = localStorage.getItem(this.storageKeys.SETTINGS);
        return settingsJSON ? JSON.parse(settingsJSON) : null;
    }

    saveSettings(settings) {
        localStorage.setItem(this.storageKeys.SETTINGS, JSON.stringify(settings));
        return true;
    }

    // Estadísticas
    getStats() {
        const students = this.getAllStudents();
        const attendances = this.getAllAttendances();
        
        return {
            totalStudents: students.length,
            activeStudents: students.filter(s => s.activo).length,
            totalAttendances: attendances.length
        };
    }
}

// Crear instancia global
window.DataManager = DataManager;
window.dataManager = new DataManager();
