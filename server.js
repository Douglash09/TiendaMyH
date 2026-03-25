const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURACIÓN DE BASE DE DATOS =====
const DB_CONFIG = {
    host: "localhost",
    user: "root",
    password: "1234",
    database: "tienda_myh"
};

// ===== CONEXIÓN MYSQL =====
const db = mysql.createConnection(DB_CONFIG);

db.connect(err => {
    if (err) {
        console.error("❌ Error conectando a MySQL:", err.message);
        process.exit(1);
    }
    console.log("✅ MySQL conectado correctamente");
});

// ===== MIDDLEWARES =====
app.use(express.json());
app.use(express.static(__dirname));

// ===== FUNCIÓN VALIDADORA =====
function validarCredenciales(usuario, password) {
    if (!usuario || !password) {
        return {
            valido: false,
            mensaje: "Usuario y contraseña son requeridos"
        };
    }
    if (usuario.length < 3) {
        return {
            valido: false,
            mensaje: "El usuario debe tener al menos 3 caracteres"
        };
    }
    return { valido: true };
}

// ===== FUNCIÓN GENÉRICA PARA LOGIN (CON BCRYPT) =====
function loginGenerico(tipo, req, res) {
    const { usuario, password } = req.body;

    // Validar credenciales
    const validacion = validarCredenciales(usuario, password);
    if (!validacion.valido) {
        return res.status(400).json({
            success: false,
            message: validacion.mensaje
        });
    }

    // Consulta con JOIN para obtener el usuario y su rol
    const sql = `
        SELECT u.id, u.usuario, u.password, u.nombre_completo, u.activo, r.nombre_rol
        FROM usuarios u
        INNER JOIN roles r ON u.id_rol = r.id
        WHERE u.usuario = ? AND r.nombre_rol = ? AND u.activo = 1
    `;

    db.query(sql, [usuario, tipo === "admin" ? "Administrador" : "Empleado"], async (err, result) => {
        if (err) {
            console.error(`❌ Error en login_${tipo}:`, err.message);
            return res.status(500).json({
                success: false,
                message: "Error interno del servidor"
            });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message: "Usuario o contraseña incorrectos",
                usuario: null,
                rol: null
            });
        }

        const user = result[0];
        const passwordValido = await bcrypt.compare(password, user.password);

        if (passwordValido) {
            // Actualizar último acceso
            const updateSql = "UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?";
            db.query(updateSql, [user.id]);
            
            return res.json({
                success: true,
                message: "Login exitoso",
                usuario: user.usuario,
                nombre_completo: user.nombre_completo,
                rol: user.nombre_rol
            });
        } else {
            return res.json({
                success: false,
                message: "Usuario o contraseña incorrectos",
                usuario: null,
                rol: null
            });
        }
    });
}

// ===== RUTAS =====

// Página principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "roles.html"));
});

// Login Admin
app.post("/login_admin", (req, res) => {
    loginGenerico("admin", req, res);
});

// Login Empleado
app.post("/login_empleado", (req, res) => {
    loginGenerico("empleado", req, res);
});

// Verificar estado de la base de datos
app.get("/api/db-check", (req, res) => {
    db.query("SELECT 1", (err) => {
        if (err) {
            return res.json({
                ok: false,
                estado: "desconectado",
                error: err.message
            });
        }
        res.json({
            ok: true,
            estado: "conectado",
            timestamp: new Date().toISOString()
        });
    });
});

// ===== MANEJO DE ERRORES 404 =====
app.use((req, res) => {
    res.status(404).json({
        error: "Ruta no encontrada",
        message: "La ruta solicitada no existe"
    });
});

// ===== MANEJO DE ERRORES GLOBAL =====
process.on('uncaughtException', (err) => {
    console.error('❌ Error no capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesa rechazada no manejada:', err);
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════╗
    ║   🚀 SERVIDOR CORRIENDO           ║
    ╠═══════════════════════════════════╣
    ║   📍 URL: http://localhost:${PORT}║
    ║   📁 Puerto: ${PORT}              ║
    ║   💾 BD: ${DB_CONFIG.database}   ║
    ╚═══════════════════════════════════╝
    `);
});