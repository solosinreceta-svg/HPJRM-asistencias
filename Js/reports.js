// =============================================
// SISTEMA DE REPORTES Y GENERACIÓN DE PDF
// =============================================

class ReportsManager {
    constructor() {
        this.currentReport = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeReportUI();
    }

    // ========== CONFIGURACIÓN INICIAL ==========

    setupEventListeners() {
        // Generar reporte
        document.getElementById('generate-report-btn')?.addEventListener('click', () => {
            this.generateWeeklyReport();
        });

        // Enviar reporte por correo
        document.getElementById('send-report-btn')?.addEventListener('click', () => {
            this.sendReportByEmail();
        });

        // Cambio de semana en el selector
        document.getElementById('report-week')?.addEventListener('change', () => {
            this.previewWeeklyReport();
        });

        // Exportar reporte actual
        document.addEventListener('exportCurrentReport', () => {
            if (this.currentReport) {
                this.exportReportToPDF(this.currentReport);
            }
        });
    }

    initializeReportUI() {
        // Establecer semana actual por defecto
        const weekInput = document.getElementById('report-week');
        if (weekInput) {
            const today = new Date();
            const startOfWeek = this.getStartOfWeek(today);
            weekInput.value = this.getWeekString(startOfWeek);
        }
    }

    // ========== GENERACIÓN DE REPORTES SEMANALES ==========

    async generateWeeklyReport() {
        try {
            const weekInput = document.getElementById('report-week');
            const weekString = weekInput?.value || this.getCurrentWeekString();
            
            this.showReportStatus('Generando reporte semanal...', 'loading');

            const report = await this.createWeeklyReport(weekString);
            this.currentReport = report;

            // Mostrar vista previa
            this.displayReportPreview(report);
            
            this.showReportStatus('Reporte generado correctamente', 'success');

        } catch (error) {
            console.error('Error generando reporte:', error);
            this.showReportStatus(`Error: ${error.message}`, 'error');
        }
    }

    async createWeeklyReport(weekString) {
        const startDate = new Date(weekString + 'T00:00:00');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        // Obtener datos
        const weeklyData = dataManager.getWeeklyReport(weekString);
        const settings = dataManager.getSettings();
        const stats = dataManager.getStats();

        // Calcular métricas de la semana
        const weekMetrics = this.calculateWeekMetrics(weeklyData);

        const report = {
            id: `report_${weekString.replace(/-/g, '')}`,
            titulo: `Reporte Semanal de Asistencia - ${this.formatWeekRange(startDate, endDate)}`,
            semana: weekString,
            fechaGeneracion: new Date().toISOString(),
            rango: {
                inicio: startDate.toISOString(),
                fin: endDate.toISOString()
            },
            datos: weeklyData,
            metricas: weekMetrics,
            configuracion: settings,
            estadisticas: stats,
            resumen: this.generateWeekSummary(weeklyData, weekMetrics)
        };

        return report;
    }

    calculateWeekMetrics(weeklyData) {
        const totalStudents = weeklyData.length;
        const studentsWithAttendance = weeklyData.filter(student => 
            student.semana.some(day => day !== 'Falta')
        ).length;
        
        const totalHours = weeklyData.reduce((sum, student) => {
            const hours = parseFloat(student.totalHoras) || 0;
            return sum + hours;
        }, 0);

        const averageHours = totalStudents > 0 ? totalHours / totalStudents : 0;

        return {
            totalEstudiantes: totalStudents,
            estudiantesConAsistencia: studentsWithAttendance,
            porcentajeAsistencia: Math.round((studentsWithAttendance / totalStudents) * 100),
            totalHoras: Math.round(totalHours * 10) / 10,
            promedioHoras: Math.round(averageHours * 10) / 10
        };
    }

    generateWeekSummary(weeklyData, metrics) {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const attendanceByDay = days.map((day, index) => {
            const studentsPresent = weeklyData.filter(student => 
                student.semana[index] !== 'Falta'
            ).length;
            return {
                dia: day,
                presentes: studentsPresent,
                porcentaje: Math.round((studentsPresent / metrics.totalEstudiantes) * 100)
            };
        });

        return {
            porDia: attendanceByDay,
            mejorAsistencia: this.getBestAttendance(weeklyData),
            estudianteMasHoras: this.getStudentMostHours(weeklyData)
        };
    }

    getBestAttendance(weeklyData) {
        if (weeklyData.length === 0) return null;
        
        return weeklyData.reduce((best, current) => {
            const currentDays = current.semana.filter(day => day !== 'Falta').length;
            const bestDays = best.semana.filter(day => day !== 'Falta').length;
            return currentDays > bestDays ? current : best;
        });
    }

    getStudentMostHours(weeklyData) {
        if (weeklyData.length === 0) return null;
        
        return weeklyData.reduce((most, current) => {
            const currentHours = parseFloat(current.totalHoras) || 0;
            const mostHours = parseFloat(most.totalHoras) || 0;
            return currentHours > mostHours ? current : most;
        });
    }

    // ========== VISTA PREVIA DE REPORTES ==========

    previewWeeklyReport() {
        const weekInput = document.getElementById('report-week');
        const weekString = weekInput?.value;
        
        if (!weekString) return;

        try {
            const weeklyData = dataManager.getWeeklyReport(weekString);
            this.displayQuickPreview(weeklyData, weekString);
        } catch (error) {
            console.error('Error en vista previa:', error);
        }
    }

    displayQuickPreview(weeklyData, weekString) {
        const previewContainer = document.getElementById('report-preview');
        if (!previewContainer) return;

        const metrics = this.calculateWeekMetrics(weeklyData);
        
        let html = `
            <div class="quick-preview">
                <h4>Vista Previa - ${this.formatWeekString(weekString)}</h4>
                <div class="preview-metrics">
                    <div class="preview-metric">
                        <span class="metric-value">${metrics.totalEstudiantes}</span>
                        <span class="metric-label">Estudiantes</span>
                    </div>
                    <div class="preview-metric">
                        <span class="metric-value">${metrics.porcentajeAsistencia}%</span>
                        <span class="metric-label">Asistencia</span>
                    </div>
                    <div class="preview-metric">
                        <span class="metric-value">${metrics.totalHoras}h</span>
                        <span class="metric-label">Total Horas</span>
                    </div>
                </div>
                <div class="preview-table">
                    <table class="data-table compact">
                        <thead>
                            <tr>
                                <th>Estudiante</th>
                                <th>Lun</th>
                                <th>Mar</th>
                                <th>Mié</th>
                                <th>Jue</th>
                                <th>Vie</th>
                                <th>Sáb</th>
                                <th>Dom</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Mostrar solo los primeros 5 estudiantes en la vista previa
        weeklyData.slice(0, 5).forEach(student => {
            html += `
                <tr>
                    <td class="student-name">${student.nombre.split(' ')[0]}...</td>
                    ${student.semana.map(day => 
                        `<td class="day-cell ${day === 'Falta' ? 'absent' : 'present'}">${day}</td>`
                    ).join('')}
                    <td class="total-cell">${student.totalHoras}</td>
                </tr>
            `;
        });

        if (weeklyData.length > 5) {
            html += `
                <tr>
                    <td colspan="9" class="text-center">
                        ...y ${weeklyData.length - 5} estudiantes más
                    </td>
                </tr>
            `;
        }

        html += `
                        </tbody>
                    </table>
                </div>
                <div class="preview-actions">
                    <button onclick="reportsManager.generateWeeklyReport()" class="btn btn-primary">
                        Generar Reporte Completo
                    </button>
                </div>
            </div>
        `;

        previewContainer.innerHTML = html;
        previewContainer.classList.remove('hidden');
    }

    displayReportPreview(report) {
        const previewContainer = document.getElementById('report-preview');
        if (!previewContainer) return;

        let html = `
            <div class="report-preview-content">
                <div class="report-header">
                    <h3>${report.titulo}</h3>
                    <div class="report-meta">
                        Generado: ${new Date(report.fechaGeneracion).toLocaleDateString('es-ES')} | 
                        Estudiantes: ${report.metricas.totalEstudiantes} | 
                        Asistencia: ${report.metricas.porcentajeAsistencia}%
                    </div>
                </div>

                <!-- Métricas Principales -->
                <div class="report-metrics-grid">
                    <div class="report-metric-card">
                        <div class="metric-icon">👥</div>
                        <div class="metric-value">${report.metricas.totalEstudiantes}</div>
                        <div class="metric-label">Total Estudiantes</div>
                    </div>
                    <div class="report-metric-card">
                        <div class="metric-icon">✅</div>
                        <div class="metric-value">${report.metricas.estudiantesConAsistencia}</div>
                        <div class="metric-label">Con Asistencia</div>
                    </div>
                    <div class="report-metric-card">
                        <div class="metric-icon">📊</div>
                        <div class="metric-value">${report.metricas.porcentajeAsistencia}%</div>
                        <div class="metric-label">Tasa de Asistencia</div>
                    </div>
                    <div class="report-metric-card">
                        <div class="metric-icon">⏱️</div>
                        <div class="metric-value">${report.metricas.totalHoras}h</div>
                        <div class="metric-label">Total Horas</div>
                    </div>
                    <div class="report-metric-card">
                        <div class="metric-icon">⭐</div>
                        <div class="metric-value">${report.metricas.promedioHoras}h</div>
                        <div class="metric-label">Promedio por Est.</div>
                    </div>
                </div>

                <!-- Asistencia por Día -->
                <div class="report-section">
                    <h4>Asistencia por Día</h4>
                    <div class="days-chart">
                        ${report.resumen.porDia.map(day => `
                            <div class="day-bar">
                                <div class="day-label">${day.dia}</div>
                                <div class="day-progress">
                                    <div class="progress-bar" style="width: ${day.porcentaje}%">
                                        <span class="progress-text">${day.presentes} (${day.porcentaje}%)</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Destacados -->
                <div class="report-section">
                    <h4>Destacados de la Semana</h4>
                    <div class="highlights-grid">
                        <div class="highlight-card">
                            <div class="highlight-icon">🏆</div>
                            <div class="highlight-content">
                                <div class="highlight-title">Mejor Asistencia</div>
                                <div class="highlight-value">
                                    ${report.resumen.mejorAsistencia?.nombre || 'N/A'}
                                </div>
                                <div class="highlight-subtitle">
                                    ${report.resumen.mejorAsistencia ? 
                                        `${report.resumen.mejorAsistencia.semana.filter(d => d !== 'Falta').length} días` : 
                                        'Sin datos'
                                    }
                                </div>
                            </div>
                        </div>
                        <div class="highlight-card">
                            <div class="highlight-icon">⏰</div>
                            <div class="highlight-content">
                                <div class="highlight-title">Más Horas</div>
                                <div class="highlight-value">
                                    ${report.resumen.estudianteMasHoras?.nombre || 'N/A'}
                                </div>
                                <div class="highlight-subtitle">
                                    ${report.resumen.estudianteMasHoras?.totalHoras || '0h'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabla Completa -->
                <div class="report-section">
                    <h4>Detalle por Estudiante</h4>
                    <div class="table-container">
                        <table class="data-table report-table">
                            <thead>
                                <tr>
                                    <th>Matrícula</th>
                                    <th>Nombre</th>
                                    <th>Grupo</th>
                                    <th>Lun</th>
                                    <th>Mar</th>
                                    <th>Mié</th>
                                    <th>Jue</th>
                                    <th>Vie</th>
                                    <th>Sáb</th>
                                    <th>Dom</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        report.datos.forEach(student => {
            html += `
                <tr>
                    <td><strong>${student.matricula}</strong></td>
                    <td>${student.nombre}</td>
                    <td>${student.grupo}</td>
                    ${student.semana.map(day => 
                        `<td class="day-cell ${day === 'Falta' ? 'absent' : day === 'Entrada' || day === 'Salida' ? 'partial' : 'present'}">
                            ${day}
                        </td>`
                    ).join('')}
                    <td class="total-cell"><strong>${student.totalHoras}</strong></td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Acciones del Reporte -->
                <div class="report-actions">
                    <button onclick="reportsManager.exportReportToPDF(reportsManager.currentReport)" 
                            class="btn btn-primary">
                        📄 Exportar a PDF
                    </button>
                    <button onclick="reportsManager.exportReportToExcel(reportsManager.currentReport)" 
                            class="btn btn-success">
                        📊 Exportar a Excel
                    </button>
                    <button onclick="reportsManager.sendReportByEmail()" 
                            class="btn btn-accent">
                        📧 Enviar por Correo
                    </button>
                    <button onclick="reportsManager.clearReportData(reportsManager.currentReport)" 
                            class="btn btn-danger">
                        🗑️ Limpiar Datos
                    </button>
                </div>
            </div>
        `;

        previewContainer.innerHTML = html;
        previewContainer.classList.remove('hidden');
    }

    // ========== EXPORTACIÓN A PDF ==========

    async exportReportToPDF(report) {
        try {
            this.showReportStatus('Generando PDF...', 'loading');

            // Crear contenido HTML para el PDF
            const pdfContent = this.generatePDFContent(report);
            
            // En un entorno real, aquí usarías una librería como jsPDF
            // Por ahora, creamos un HTML que el usuario puede imprimir
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${report.titulo}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px; 
                            color: #333;
                        }
                        .header { 
                            text-align: center; 
                            border-bottom: 2px solid #4a6ee0; 
                            padding-bottom: 20px; 
                            margin-bottom: 30px;
                        }
                        .metrics { 
                            display: grid; 
                            grid-template-columns: repeat(5, 1fr); 
                            gap: 10px; 
                            margin: 20px 0; 
                        }
                        .metric-card { 
                            text-align: center; 
                            padding: 15px; 
                            border: 1px solid #ddd; 
                            border-radius: 5px;
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin: 20px 0; 
                        }
                        th, td { 
                            border: 1px solid #ddd; 
                            padding: 8px; 
                            text-align: left; 
                        }
                        th { 
                            background-color: #f8f9fa; 
                        }
                        .absent { background-color: #f8d7da; }
                        .present { background-color: #d1edff; }
                        .partial { background-color: #fff3cd; }
                        .footer { 
                            margin-top: 30px; 
                            text-align: center; 
                            font-size: 12px; 
                            color: #666;
                        }
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${pdfContent}
                    <div class="footer">
                        Generado por Sistema de Asistencia HPJRM - ${new Date().toLocaleDateString('es-ES')}
                    </div>
                    <div class="no-print" style="margin-top: 20px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #4a6ee0; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            🖨️ Imprimir Reporte
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                            Cerrar
                        </button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();

            this.showReportStatus('PDF generado correctamente', 'success');

        } catch (error) {
            console.error('Error generando PDF:', error);
            this.showReportStatus(`Error generando PDF: ${error.message}`, 'error');
        }
    }

    generatePDFContent(report) {
        return `
            <div class="header">
                <h1>${report.titulo}</h1>
                <p><strong>Período:</strong> ${this.formatWeekRange(new Date(report.rango.inicio), new Date(report.rango.fin))}</p>
                <p><strong>Generado:</strong> ${new Date(report.fechaGeneracion).toLocaleDateString('es-ES', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
            </div>

            <div class="metrics">
                <div class="metric-card">
                    <h3>${report.metricas.totalEstudiantes}</h3>
                    <p>Total Estudiantes</p>
                </div>
                <div class="metric-card">
                    <h3>${report.metricas.estudiantesConAsistencia}</h3>
                    <p>Con Asistencia</p>
                </div>
                <div class="metric-card">
                    <h3>${report.metricas.porcentajeAsistencia}%</h3>
                    <p>Tasa de Asistencia</p>
                </div>
                <div class="metric-card">
                    <h3>${report.metricas.totalHoras}h</h3>
                    <p>Total Horas</p>
                </div>
                <div class="metric-card">
                    <h3>${report.metricas.promedioHoras}h</h3>
                    <p>Promedio por Est.</p>
                </div>
            </div>

            <h3>Detalle por Estudiante</h3>
            <table>
                <thead>
                    <tr>
                        <th>Matrícula</th>
                        <th>Nombre</th>
                        <th>Grupo</th>
                        <th>Lun</th>
                        <th>Mar</th>
                        <th>Mié</th>
                        <th>Jue</th>
                        <th>Vie</th>
                        <th>Sáb</th>
                        <th>Dom</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.datos.map(student => `
                        <tr>
                            <td><strong>${student.matricula}</strong></td>
                            <td>${student.nombre}</td>
                            <td>${student.grupo}</td>
                            ${student.semana.map(day => 
                                `<td class="${day === 'Falta' ? 'absent' : day === 'Entrada' || day === 'Salida' ? 'partial' : 'present'}">
                                    ${day}
                                </td>`
                            ).join('')}
                            <td><strong>${student.totalHoras}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 30px;">
                <h3>Resumen Ejecutivo</h3>
                <p><strong>Mejor Asistencia:</strong> ${report.resumen.mejorAsistencia?.nombre || 'N/A'} 
                   (${report.resumen.mejorAsistencia ? report.resumen.mejorAsistencia.semana.filter(d => d !== 'Falta').length + ' días' : 'Sin datos'})</p>
                <p><strong>Estudiante con más horas:</strong> ${report.resumen.estudianteMasHoras?.nombre || 'N/A'} 
                   (${report.resumen.estudianteMasHoras?.totalHoras || '0h'})</p>
            </div>
        `;
    }

    // ========== EXPORTACIÓN A EXCEL ==========

    async exportReportToExcel(report) {
        try {
            this.showReportStatus('Generando Excel...', 'loading');

            const excelData = this.convertReportToExcel(report);
            dashboardManager.downloadFile(
                excelData.content,
                excelData.filename,
                excelData.type
            );

            this.showReportStatus('Excel exportado correctamente', 'success');

        } catch (error) {
            console.error('Error exportando a Excel:', error);
            this.showReportStatus(`Error exportando Excel: ${error.message}`, 'error');
        }
    }

    convertReportToExcel(report) {
        // Cabeceras
        let csvContent = '\uFEFF'; // BOM para UTF-8
        const headers = [
            'Matrícula', 'Nombre', 'Grupo', 
            'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 
            'Total Horas'
        ];
        csvContent += headers.join(',') + '\n';

        // Datos
        report.datos.forEach(student => {
            const row = [
                `"${student.matricula}"`,
                `"${student.nombre}"`,
                `"${student.grupo}"`,
                ...student.semana.map(day => `"${day}"`),
                `"${student.totalHoras}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        // Métricas
        csvContent += '\n"RESUMEN EJECUTIVO"\n';
        csvContent += `"Total Estudiantes","${report.metricas.totalEstudiantes}"\n`;
        csvContent += `"Estudiantes con Asistencia","${report.metricas.estudiantesConAsistencia}"\n`;
        csvContent += `"Tasa de Asistencia","${report.metricas.porcentajeAsistencia}%"\n`;
        csvContent += `"Total Horas","${report.metricas.totalHoras}h"\n`;
        csvContent += `"Promedio por Estudiante","${report.metricas.promedioHoras}h"\n`;

        return {
            content: csvContent,
            filename: `reporte_semanal_${report.semana}.csv`,
            type: 'text/csv;charset=utf-8;'
        };
    }

    // ========== ENVÍO POR CORREO ==========

    async sendReportByEmail() {
        try {
            if (!this.currentReport) {
                throw new Error('No hay reporte generado para enviar');
            }

            const settings = dataManager.getSettings();
            const adminEmail = settings?.adminEmail;

            if (!adminEmail) {
                throw new Error('Configure un email administrativo en Configuración');
            }

            this.showReportStatus('Preparando envío...', 'loading');

            // En un entorno real, aquí conectarías con un servicio de email
            // Por ahora, simulamos el envío y mostramos los datos
            const emailContent = this.generateEmailContent(this.currentReport);
            
            // Abrir cliente de email
            const subject = encodeURIComponent(this.currentReport.titulo);
            const body = encodeURIComponent(emailContent);
            const mailtoLink = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
            
            window.location.href = mailtoLink;

            this.showReportStatus('Cliente de email abierto. Complete el envío manualmente.', 'success');

        } catch (error) {
            console.error('Error enviando reporte:', error);
            this.showReportStatus(`Error: ${error.message}`, 'error');
        }
    }

    generateEmailContent(report) {
        return `
Reporte Semanal de Asistencia HPJRM

Período: ${this.formatWeekRange(new Date(report.rango.inicio), new Date(report.rango.fin))}
Generado: ${new Date().toLocaleDateString('es-ES')}

RESUMEN:
• Total Estudiantes: ${report.metricas.totalEstudiantes}
• Estudiantes con Asistencia: ${report.metricas.estudiantesConAsistencia}
• Tasa de Asistencia: ${report.metricas.porcentajeAsistencia}%
• Total Horas en Hospital: ${report.metricas.totalHoras}h
• Promedio por Estudiante: ${report.metricas.promedioHoras}h

DESTACADOS:
• Mejor Asistencia: ${report.resumen.mejorAsistencia?.nombre || 'N/A'}
• Estudiante con más horas: ${report.resumen.estudianteMasHoras?.nombre || 'N/A'}

Este reporte fue generado automáticamente por el Sistema de Asistencia HPJRM.

--
Sistema de Asistencia Hospitalaria HPJRM
        `.trim();
    }

    // ========== LIMPIEZA DE DATOS ==========

    async clearReportData(report) {
        if (!confirm(`¿ESTÁ SEGURO de que desea eliminar los datos de la semana ${report.semana}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            this.showReportStatus('Eliminando datos...', 'loading');

            const startDate = new Date(report.rango.inicio);
            const endDate = new Date(report.rango.fin);
            
            // Obtener todas las asistencias
            const allAttendances = dataManager.getAllAttendances();
            
            // Filtrar las asistencias que NO están en el rango de la semana
            const keepAttendances = allAttendances.filter(attendance => {
                const attendanceDate = new Date(attendance.asistencia.timestamp);
                return attendanceDate < startDate || attendanceDate > endDate;
            });

            // Guardar las asistencias filtradas
            localStorage.setItem('hpjrm_attendances', JSON.stringify(keepAttendances));
            
            const deletedCount = allAttendances.length - keepAttendances.length;
            
            // Emitir evento de datos actualizados
            dataManager.emitDataEvent('dataCleaned', { 
                deletedCount, 
                week: report.semana 
            });

            this.showReportStatus(`${deletedCount} registros eliminados correctamente`, 'success');
            
            // Actualizar dashboards
            if (dashboardManager.currentScreen === 'admin-dashboard') {
                dashboardManager.updateAdminDashboard();
            }

            // Limpiar reporte actual
            this.currentReport = null;
            document.getElementById('report-preview').classList.add('hidden');

        } catch (error) {
            console.error('Error eliminando datos:', error);
            this.showReportStatus(`Error eliminando datos: ${error.message}`, 'error');
        }
    }

    // ========== UTILIDADES ==========

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    getWeekString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-W${String(Math.ceil(date.getDate() / 7)).padStart(2, '0')}`;
    }

    getCurrentWeekString() {
        return this.getWeekString(new Date());
    }

    formatWeekRange(startDate, endDate) {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return `${startDate.toLocaleDateString('es-ES', options)} - ${endDate.toLocaleDateString('es-ES', options)}`;
    }

    formatWeekString(weekString) {
        const [year, week] = weekString.split('-W');
        const startDate = new Date(year, 0, 1 + (week - 1) * 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        return this.formatWeekRange(startDate, endDate);
    }

    showReportStatus(message, type = 'info') {
        dashboardManager.showAlert(message, type);
    }
}

// Estilos para reportes
const loadReportsStyles = () => {
    const styles = `
        .quick-preview {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .preview-metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
        }
        
        .preview-metric {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        
        .preview-metric .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #4a6ee0;
            display: block;
        }
        
        .preview-metric .metric-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        
        .report-preview-content {
            max-height: 70vh;
            overflow-y: auto;
        }
        
        .report-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .report-header h3 {
            color: #4a6ee0;
            margin-bottom: 10px;
        }
        
        .report-meta {
            color: #666;
            font-size: 14px;
        }
        
        .report-metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 25px 0;
        }
        
        .report-metric-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e9ecef;
            transition: transform 0.2s;
        }
        
        .report-metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .metric-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .report-metric-card .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #4a6ee0;
            margin: 10px 0;
        }
        
        .report-metric-card .metric-label {
            font-size: 14px;
            color: #666;
        }
        
        .report-section {
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 12px;
            border: 1px solid #e9ecef;
        }
        
        .report-section h4 {
            color: #4a6ee0;
            margin-bottom: 20px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 10px;
        }
        
        .days-chart {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .day-bar {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .day-label {
            width: 80px;
            font-weight: 500;
        }
        
        .day-progress {
            flex: 1;
            background: #e9ecef;
            border-radius: 20px;
            overflow: hidden;
            height: 30px;
        }
        
        .progress-bar {
            background: linear-gradient(135deg, #4a6ee0, #667eea);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: width 0.5s ease;
        }
        
        .progress-text {
            color: white;
            font-size: 12px;
            font-weight: 500;
        }
        
        .highlights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .highlight-card {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #4a6ee0;
        }
        
        .highlight-icon {
            font-size: 32px;
        }
        
        .highlight-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .highlight-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        
        .highlight-subtitle {
            font-size: 12px;
            color: #888;
        }
        
        .table-container {
            overflow-x: auto;
        }
        
        .report-table {
            font-size: 14px;
        }
        
        .report-table th {
            background: #4a6ee0;
            color: white;
        }
        
        .day-cell {
            text-align: center;
            font-weight: 500;
        }
        
        .day-cell.absent {
            background-color: #f8d7da;
            color: #721c24;
        }
        
        .day-cell.present {
            background-color: #d1edff;
            color: #155724;
        }
        
        .day-cell.partial {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .total-cell {
            font-weight: bold;
            text-align: center;
            background: #f8f9fa;
        }
        
        .report-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        
        .data-table.compact {
            font-size: 12px;
        }
        
        .data-table.compact th,
        .data-table.compact td {
            padding: 8px 10px;
        }
        
        .student-name {
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        @media (max-width: 768px) {
            .report-metrics-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .highlights-grid {
                grid-template-columns: 1fr;
            }
            
            .report-actions {
                flex-direction: column;
            }
            
            .report-actions .btn {
                width: 100%;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Inicializar estilos
loadReportsStyles();

// Crear instancia global
const reportsManager = new ReportsManager();