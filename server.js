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
    
    crearTablaCategorias();
    crearTablaProductos();
    crearTablaLotes();
});

// =============================================
// ========== CREAR TABLAS ====================
// =============================================

function crearTablaCategorias() {
    const sql = `
        CREATE TABLE IF NOT EXISTS categorias (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nombre VARCHAR(50) UNIQUE NOT NULL,
            descripcion TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error creando tabla categorías:", err.message);
        } else {
            insertarCategoriasDefault();
        }
    });
}

function insertarCategoriasDefault() {
    const categorias = ['Lácteos', 'Carnes', 'Verduras', 'Frutas', 'Abarrotes', 'Bebidas', 'Limpieza', 'Higiene Personal', 'Panadería', 'Congelados'];
    categorias.forEach(cat => {
        db.query("INSERT IGNORE INTO categorias (nombre) VALUES (?)", [cat]);
    });
}

function crearTablaProductos() {
    const sql = `
        CREATE TABLE IF NOT EXISTS productos (
            id INT PRIMARY KEY AUTO_INCREMENT,
            codigo_barras VARCHAR(50) NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            descripcion TEXT,
            categoria VARCHAR(50) NOT NULL,
            precio_compra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock INT NOT NULL DEFAULT 0,
            stock_minimo INT NOT NULL DEFAULT 5,
            unidad_medida VARCHAR(20) DEFAULT 'unidad',
            proveedor VARCHAR(100),
            ubicacion VARCHAR(50),
            formato_venta ENUM('Unidad', 'Paquete', 'Fardo', 'Caja', 'Docena') DEFAULT 'Unidad',
            cantidad_formato INT DEFAULT 1,
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
            console.log("✅ Tabla productos lista");
        }
    });
}

function crearTablaLotes() {
    const sql = `
        CREATE TABLE IF NOT EXISTS lotes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            producto_id INT NOT NULL,
            numero_lote VARCHAR(50) NOT NULL,
            cantidad INT NOT NULL DEFAULT 0,
            precio_compra DECIMAL(10,2),
            fecha_vencimiento DATE,
            fecha_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
            INDEX idx_producto (producto_id),
            INDEX idx_fecha_vencimiento (fecha_vencimiento)
        )
    `;
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error creando tabla lotes:", err.message);
        } else {
            console.log("✅ Tabla lotes lista");
        }
    });
}

// ===== MIDDLEWARES =====
app.use(express.json());
app.use(express.static(__dirname));

// =============================================
// ========== RUTAS DE PRODUCTOS ===============
// =============================================

// Obtener todos los productos
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error("Error obteniendo productos:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Buscar producto por código de barras o nombre
app.get('/api/products/barcode/:codigo', (req, res) => {
    const { codigo } = req.params;
    db.query('SELECT * FROM productos WHERE codigo_barras = ? OR nombre LIKE ?', [codigo, `%${codigo}%`], (err, results) => {
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
        codigo_barras, nombre, descripcion, categoria, 
        precio_compra, precio_venta, stock, stock_minimo, 
        unidad_medida, proveedor, ubicacion, formato_venta, 
        cantidad_formato, fecha_vencimiento 
    } = req.body;
    
    const sql = `INSERT INTO productos 
        (codigo_barras, nombre, descripcion, categoria, precio_compra, precio_venta, 
         stock, stock_minimo, unidad_medida, proveedor, ubicacion, formato_venta, 
         cantidad_formato, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [
        codigo_barras, nombre, descripcion, categoria, 
        precio_compra || 0, precio_venta || 0, 
        stock || 0, stock_minimo || 5, 
        unidad_medida, proveedor, ubicacion, 
        formato_venta || 'Unidad', cantidad_formato || 1, 
        fecha_vencimiento || null
    ], (err, result) => {
        if (err) {
            console.error("Error creando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, id: result.insertId, message: "Producto creado exitosamente" });
    });
});

// Actualizar producto
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
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
    db.query('DELETE FROM productos WHERE id=?', [id], (err) => {
        if (err) {
            console.error("Error eliminando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Producto eliminado exitosamente" });
    });
});

// Obtener todas las categorías
app.get('/api/categories', (req, res) => {
    db.query('SELECT * FROM categorias ORDER BY nombre', (err, results) => {
        if (err) {
            console.error("Error obteniendo categorías:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Crear nueva categoría
app.post('/api/categories', (req, res) => {
    const { nombre, descripcion } = req.body;
    
    if (!nombre) {
        return res.status(400).json({ ok: false, error: "El nombre es obligatorio" });
    }
    
    db.query('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion || null], (err, result) => {
        if (err) {
            console.error("Error creando categoría:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, id: result.insertId, message: "Categoría creada exitosamente" });
    });
});

// Obtener estadísticas de productos (para el dashboard)
app.get('/api/products/stats', (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total_productos,
            SUM(stock) as stock_total,
            SUM(precio_venta * stock) as valor_total,
            SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END) as alertas_stock,
            COUNT(DISTINCT categoria) as categorias_activas,
            AVG(precio_venta) as precio_promedio
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

// =============================================
// ========== RUTAS DE LOTES ===================
// =============================================

// Obtener todos los lotes de un producto (ordenados por fecha de vencimiento ASC - más viejo primero)
app.get('/api/batches/product/:productoId', (req, res) => {
    const { productoId } = req.params;
    const sql = 'SELECT * FROM lotes WHERE producto_id = ? ORDER BY fecha_vencimiento ASC, fecha_entrada ASC';
    
    db.query(sql, [productoId], (err, results) => {
        if (err) {
            console.error("Error obteniendo lotes:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Registrar nuevo lote (actualiza stock automáticamente)
app.post('/api/batches', (req, res) => {
    const { producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote } = req.body;
    
    if (!producto_id || !cantidad || !numero_lote) {
        return res.status(400).json({ ok: false, error: "Producto, cantidad y número de lote son obligatorios" });
    }
    
    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
        
        const sqlLote = `INSERT INTO lotes 
            (producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote) 
            VALUES (?, ?, ?, ?, ?)`;
        
        db.query(sqlLote, [producto_id, cantidad, fecha_vencimiento || null, precio_compra || null, numero_lote], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error insertando lote:", err);
                    res.status(500).json({ ok: false, error: err.message });
                });
            }
            
            const sqlUpdateStock = 'UPDATE productos SET stock = stock + ? WHERE id = ?';
            db.query(sqlUpdateStock, [cantidad, producto_id], (err) => {
                if (err) {
                    return db.rollback(() => {
                        console.error("Error actualizando stock:", err);
                        res.status(500).json({ ok: false, error: err.message });
                    });
                }
                
                const sqlUpdateFecha = `UPDATE productos SET fecha_vencimiento = ? 
                    WHERE id = ? AND (fecha_vencimiento IS NULL OR fecha_vencimiento > ?)`;
                db.query(sqlUpdateFecha, [fecha_vencimiento || null, producto_id, fecha_vencimiento || null], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error actualizando fecha:", err);
                            res.status(500).json({ ok: false, error: err.message });
                        });
                    }
                    
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error en commit:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        res.json({ ok: true, id: result.insertId, message: "Lote registrado exitosamente" });
                    });
                });
            });
        });
    });
});

// Actualizar lote existente (PUT)
app.put('/api/batches/:id', (req, res) => {
    const loteId = req.params.id;
    const { producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote } = req.body;
    
    db.query('SELECT * FROM lotes WHERE id = ?', [loteId], (err, loteActual) => {
        if (err) {
            console.error("Error obteniendo lote:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        if (loteActual.length === 0) {
            return res.status(404).json({ ok: false, error: "Lote no encontrado" });
        }
        
        const diferenciaCantidad = cantidad - loteActual[0].cantidad;
        
        db.beginTransaction(err => {
            if (err) {
                return res.status(500).json({ ok: false, error: err.message });
            }
            
            const sqlUpdate = 'UPDATE lotes SET cantidad = ?, fecha_vencimiento = ?, precio_compra = ?, numero_lote = ? WHERE id = ?';
            db.query(sqlUpdate, [cantidad, fecha_vencimiento || null, precio_compra || null, numero_lote, loteId], (err) => {
                if (err) {
                    return db.rollback(() => {
                        console.error("Error actualizando lote:", err);
                        res.status(500).json({ ok: false, error: err.message });
                    });
                }
                
                if (diferenciaCantidad !== 0) {
                    db.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [diferenciaCantidad, producto_id], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error actualizando stock:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        
                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error("Error en commit:", err);
                                    res.status(500).json({ ok: false, error: err.message });
                                });
                            }
                            res.json({ ok: true, message: "Lote actualizado exitosamente" });
                        });
                    });
                } else {
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error en commit:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        res.json({ ok: true, message: "Lote actualizado exitosamente" });
                    });
                }
            });
        });
    });
});

// Eliminar lote (DELETE)
app.delete('/api/batches/:id', (req, res) => {
    const loteId = req.params.id;
    
    db.query('SELECT * FROM lotes WHERE id = ?', [loteId], (err, lote) => {
        if (err) {
            console.error("Error obteniendo lote:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        if (lote.length === 0) {
            return res.status(404).json({ ok: false, error: "Lote no encontrado" });
        }
        
        db.beginTransaction(err => {
            if (err) {
                return res.status(500).json({ ok: false, error: err.message });
            }
            
            db.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [lote[0].cantidad, lote[0].producto_id], (err) => {
                if (err) {
                    return db.rollback(() => {
                        console.error("Error actualizando stock:", err);
                        res.status(500).json({ ok: false, error: err.message });
                    });
                }
                
                db.query('DELETE FROM lotes WHERE id = ?', [loteId], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error eliminando lote:", err);
                            res.status(500).json({ ok: false, error: err.message });
                        });
                    }
                    
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error en commit:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        res.json({ ok: true, message: "Lote eliminado exitosamente" });
                    });
                });
            });
        });
    });
});

// Obtener todos los lotes (con información del producto)
app.get('/api/batches', (req, res) => {
    const sql = `
        SELECT l.*, p.nombre as producto_nombre, p.codigo_barras, p.formato_venta
        FROM lotes l
        JOIN productos p ON l.producto_id = p.id
        ORDER BY l.fecha_vencimiento ASC, l.fecha_entrada ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo lotes:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// =============================================
// ========== RUTAS DE AUTENTICACIÓN ===========
// =============================================

// IMPORTANTE: Servir roles.html como página principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "roles.html"));
});

// Servir también la página de productos/gestión
app.get("/gestion", (req, res) => {
    res.sendFile(path.join(__dirname, "gestion.html"));
});

// Login Admin
app.post("/login_admin", (req, res) => {
    loginGenerico("admin", req, res);
});

// Login Empleado
app.post("/login_empleado", (req, res) => {
    loginGenerico("empleado", req, res);
});

// ===== FUNCIÓN GENÉRICA PARA LOGIN =====
function validarCredenciales(usuario, password) {
    if (!usuario || !password) {
        return { valido: false, mensaje: "Usuario y contraseña son requeridos" };
    }
    if (usuario.length < 3) {
        return { valido: false, mensaje: "El usuario debe tener al menos 3 caracteres" };
    }
    return { valido: true };
}

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
    ║   📄 Página principal: roles.html                 ║
    ║   💵 Moneda: USD ($)                              ║
    ║   📦 API Productos: Activa                        ║
    ║   📦 API Lotes: Activa (CRUD completo)            ║
    ║   📦 API Categorías: Activa                       ║
    ╚═══════════════════════════════════════════════════╝
    `);
});