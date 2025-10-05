# 🏥 Sistema de Asistencia Hospitalaria HPJRM

Sistema web progresivo (PWA) para registro de asistencia de estudiantes de medicina mediante escaneo de códigos QR con verificación de ubicación GPS.

## ✨ Características Principales

### 🔐 Autenticación Dual
- **Estudiantes**: Formato 2025XXXX (8 dígitos)
- **Administradores**: Contraseña `2025hpjrm`
- Sesiones persistentes offline

### 📱 Funcionalidades Móviles
- Escáner QR con cámara real
- Geolocalización precisa (500m radio)
- Registro de entrada y salida
- Funcionamiento 100% offline
- Interfaz mobile-first responsive

### 📊 Dashboard Administrativo
- Métricas en tiempo real
- Gestión de estudiantes
- Reportes semanales automáticos
- Exportación PDF/Excel/CSV
- Sistema de backup y restauración

### 🚀 Tecnología
- Aplicación Web Progresiva (PWA)
- Single HTML File (sin dependencias externas)
- Almacenamiento local (localStorage)
- Service Worker para offline
- Compatible con WebIntoApp para APK

## 🛠️ Instalación y Deployment

### 1. Preparar Archivos