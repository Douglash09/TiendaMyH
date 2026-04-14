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
    
    // Crear tabla de productos si no existe
    crearTablaProductos();
    // Crear tabla de categorías
    crearTablaCategorias();
});

// ===== FUNCIÓN PARA CREAR TABLA DE PRODUCTOS =====
function crearTablaProductos() {
    const sql = `
        CREATE TABLE IF NOT EXISTS productos (
            id INT PRIMARY KEY AUTO_INCREMENT,
            codigo_barras VARCHAR(50) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            descripcion TEXT,
            categoria VARCHAR(50) NOT NULL,
            precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock INT NOT NULL DEFAULT 0,
            stock_minimo INT NOT NULL DEFAULT 5,
            unidad_medida VARCHAR(20) DEFAULT 'unidad',
            proveedor VARCHAR(100),
            ubicacion VARCHAR(50),
            fecha_vencimiento DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_codigo_barras (codigo_barras),
            INDEX idx_categoria (categoria),
            INDEX idx_stock (stock)
        )
    `;
    
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error creando tabla productos:", err.message);
        } else {
            console.log("---");
        }
    });
}

// ===== FUNCIÓN PARA CREAR TABLA DE CATEGORÍAS =====
function crearTablaCategorias() {
    const sql = `
        CREATE TABLE IF NOT EXISTS categorias (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nombre VARCHAR(50) UNIQUE NOT NULL,
            descripcion TEXT
        )
    `;
    
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error creando tabla categorías:", err.message);
        } else {
            console.log();
            // Insertar categorías por defecto
            insertarCategoriasDefault();
        }
    });
}

// ===== INSERTAR CATEGORÍAS POR DEFECTO =====
function insertarCategoriasDefault() {
    const categorias = [
        'Lácteos', 'Carnes', 'Verduras', 'Frutas', 'Abarrotes',
        'Bebidas', 'Limpieza', 'Higiene Personal', 'Panadería', 'Congelados'
    ];
    
    categorias.forEach(cat => {
        const sql = "INSERT IGNORE INTO categorias (nombre) VALUES (?)";
        db.query(sql, [cat]);
    });
}

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

    const validacion = validarCredenciales(usuario, password);
    if (!validacion.valido) {
        return res.status(400).json({
            success: false,
            message: validacion.mensaje
        });
    }

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

// ===== RUTAS DE PRODUCTOS =====

// Obtener todos los productos
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM productos ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo productos:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Buscar producto por código de barras
app.get('/api/products/barcode/:codigo', (req, res) => {
    const { codigo } = req.params;
    const sql = 'SELECT * FROM productos WHERE codigo_barras = ?';
    db.query(sql, [codigo], (err, results) => {
        if (err) {
            console.error("Error buscando por código:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results[0] || null });
    });
});

// Crear nuevo producto
app.post('/api/products', (req, res) => {
    const { 
        codigo_barras, nombre, descripcion, categoria, precio, 
        stock, stock_minimo, unidad_medida, proveedor, ubicacion, fecha_vencimiento 
    } = req.body;
    
    const sql = `INSERT INTO productos 
        (codigo_barras, nombre, descripcion, categoria, precio, stock, stock_minimo, unidad_medida, proveedor, ubicacion, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [codigo_barras, nombre, descripcion, categoria, precio, stock, stock_minimo, unidad_medida, proveedor, ubicacion, fecha_vencimiento], 
        (err, result) => {
            if (err) {
                console.error("Error creando producto:", err);
                return res.status(500).json({ ok: false, error: err.message });
            }
            res.json({ ok: true, id: result.insertId, message: "Producto creado exitosamente" });
        }
    );
});

// Actualizar producto
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Construir dinámicamente la consulta UPDATE
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key}=?`);
            values.push(updates[key]);
        }
    });
    
    if (fields.length === 0) {
        return res.status(400).json({ ok: false, error: "No hay campos para actualizar" });
    }
    
    values.push(id);
    const sql = `UPDATE productos SET ${fields.join(', ')} WHERE id=?`;
    
    db.query(sql, values, (err) => {
        if (err) {
            console.error("Error actualizando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Producto actualizado exitosamente" });
    });
});

// Eliminar producto
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM productos WHERE id=?';
    
    db.query(sql, [id], (err) => {
        if (err) {
            console.error("Error eliminando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Producto eliminado exitosamente" });
    });
});

// Obtener todas las categorías
app.get('/api/categories', (req, res) => {
    const sql = 'SELECT * FROM categorias ORDER BY nombre';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo categorías:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Obtener estadísticas de productos (para el dashboard)
app.get('/api/products/stats', (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total_productos,
            SUM(stock) as stock_total,
            SUM(precio * stock) as valor_total,
            SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END) as alertas_stock,
            COUNT(DISTINCT categoria) as categorias_activas,
            AVG(precio) as precio_promedio
        FROM productos
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo estadísticas:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results[0] });
    });
});

// ===== RUTAS DE AUTENTICACIÓN =====

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
    ╔═══════════════════════════════════════════════════╗
    ║   🚀 SERVIDOR CORRIENDO                           ║
    ╠═══════════════════════════════════════════════════╣
    ║   📍 URL: http://localhost:${PORT}                 ║
    ║   📁 Puerto: ${PORT}                              ║
    ║   💾 BD: ${DB_CONFIG.database}                   ║
    ║   📦 API Productos: Activa                        ║
    ╚═══════════════════════════════════════════════════╝
    `);
});