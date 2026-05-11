const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bcrypt = require("bcrypt");
const fs = require("fs-extra");
const multer = require("multer");

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

// Asegurar que la carpeta tickets existe
const ticketsDir = path.join(__dirname, 'tickets');
fs.ensureDirSync(ticketsDir);
console.log(`📁 Carpeta de tickets: ${ticketsDir}`);

// Carpeta de reportes
const reportesDir = "C:/Users/omar0/Documents/GitHub/TiendaMyH/reportes";
fs.ensureDirSync(reportesDir);
console.log(`📁 Carpeta de reportes: ${reportesDir}`);

// ===== CONFIGURACIÓN DE MULTER PARA PDFs =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, ticketsDir)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});
const upload = multer({ storage: storage });

// Configuración de multer para reportes PDF
const storageReportes = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, reportesDir)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});
const uploadReporte = multer({ storage: storageReportes });

db.connect(err => {
    if (err) {
        console.error("❌ Error conectando a MySQL:", err.message);
        process.exit(1);
    }
    console.log("✅ MySQL conectado correctamente");
    
    crearTablaCategorias();
    crearTablaProductos();
    crearTablaLotes();
    crearTablaVentas();
    crearTablaDetalleVenta();
    crearTablaUsuarios();
    crearTablaRoles();
    crearTablaReportes();
    insertarDatosDefault();
});

// =============================================
// ========== CREAR TABLAS ====================
// =============================================

function crearTablaRoles() {
    const sql = `
        CREATE TABLE IF NOT EXISTS roles (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nombre_rol VARCHAR(50) NOT NULL UNIQUE,
            descripcion TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla roles:", err.message);
        else console.log("✅ Tabla roles lista");
    });
}

function crearTablaUsuarios() {
    const sql = `
        CREATE TABLE IF NOT EXISTS usuarios (
            id INT PRIMARY KEY AUTO_INCREMENT,
            id_rol INT NOT NULL,
            usuario VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            nombre_completo VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            telefono VARCHAR(20),
            direccion TEXT,
            fecha_nacimiento DATE,
            fecha_contratacion DATE,
            activo BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ultimo_acceso TIMESTAMP NULL,
            FOREIGN KEY (id_rol) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla usuarios:", err.message);
        else console.log("✅ Tabla usuarios lista");
    });
}

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
        if (err) console.error("❌ Error creando tabla categorías:", err.message);
        else console.log("✅ Tabla categorías lista");
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
            unidad_medida ENUM('Pieza', 'Kilogramo', 'Gramo', 'Litro', 'Mililitro', 'Metro', 'Centímetro', 'Paquete', 'Caja', 'Fardo', 'Docena', 'Bolsa', 'Botella', 'Lata') NOT NULL DEFAULT 'Pieza',
            cantidad_por_unidad INT NOT NULL DEFAULT 1,
            proveedor VARCHAR(100),
            ubicacion VARCHAR(50),
            fecha_vencimiento DATE,
            imagen LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_codigo_barras (codigo_barras),
            INDEX idx_categoria (categoria),
            INDEX idx_stock (stock)
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla productos:", err.message);
        else console.log("✅ Tabla productos lista");
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
            INDEX idx_numero_lote (numero_lote),
            INDEX idx_fecha_vencimiento (fecha_vencimiento)
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla lotes:", err.message);
        else console.log("✅ Tabla lotes lista");
    });
}

function crearTablaVentas() {
    const sql = `
        CREATE TABLE IF NOT EXISTS venta (
            id INT PRIMARY KEY AUTO_INCREMENT,
            folio VARCHAR(20) NOT NULL UNIQUE,
            id_usuario INT NOT NULL,
            fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subtotal DECIMAL(10,2) NOT NULL,
            iva DECIMAL(10,2) DEFAULT 0.00,
            total DECIMAL(10,2) NOT NULL,
            metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia') DEFAULT 'efectivo',
            estado ENUM('completada', 'cancelada', 'pendiente') DEFAULT 'completada',
            INDEX idx_folio (folio),
            INDEX idx_fecha (fecha_venta)
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla ventas:", err.message);
        else console.log("✅ Tabla ventas lista");
    });
}

function crearTablaDetalleVenta() {
    const sql = `
        CREATE TABLE IF NOT EXISTS detalle_venta (
            id INT PRIMARY KEY AUTO_INCREMENT,
            id_venta INT NOT NULL,
            id_producto INT NOT NULL,
            cantidad INT NOT NULL,
            precio_unitario DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (id_venta) REFERENCES venta(id) ON DELETE CASCADE,
            FOREIGN KEY (id_producto) REFERENCES productos(id) ON DELETE CASCADE,
            INDEX idx_venta (id_venta),
            INDEX idx_producto (id_producto)
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla detalle_venta:", err.message);
        else console.log("✅ Tabla detalle_venta lista");
    });
}

function crearTablaReportes() {
    const sql = `
        CREATE TABLE IF NOT EXISTS reportes_ventas (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nombre_archivo VARCHAR(255) NOT NULL,
            ruta_archivo VARCHAR(500) NOT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            periodo VARCHAR(100) NOT NULL,
            total_ventas INT NOT NULL DEFAULT 0,
            monto_total DECIMAL(10,2) NOT NULL DEFAULT 0,
            ganancia_total DECIMAL(10,2) NOT NULL DEFAULT 0,
            productos_vendidos INT NOT NULL DEFAULT 0,
            generado_por VARCHAR(100),
            fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_fecha_generacion (fecha_generacion),
            INDEX idx_periodo (periodo)
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("❌ Error creando tabla reportes_ventas:", err.message);
        else console.log("✅ Tabla reportes_ventas lista");
    });
}

function insertarDatosDefault() {
    // Insertar roles
    db.query("INSERT IGNORE INTO roles (nombre_rol, descripcion) VALUES ('Administrador', 'Acceso total al sistema'), ('Empleado', 'Acceso a ventas y consulta de inventario')");
    
    // Insertar categorías
    const categorias = ['Lácteos', 'Carnes', 'Verduras', 'Frutas', 'Abarrotes', 'Bebidas', 'Limpieza', 'Higiene Personal', 'Panadería', 'Congelados'];
    categorias.forEach(cat => {
        db.query("INSERT IGNORE INTO categorias (nombre) VALUES (?)", [cat]);
    });
    
    // Insertar usuarios (contraseña: 1234 encriptada)
    db.query(`INSERT IGNORE INTO usuarios (id_rol, usuario, password, nombre_completo) VALUES 
        (1, 'douglas', '$2b$10$qprHTjY81.orlLHOs0T6OOK0NCXJR3oiCKcPYrcGWAeIqs/Mg9Pte', 'Douglas Omar Mendez Hernandez'),
        (1, 'admin', '$2b$10$qprHTjY81.orlLHOs0T6OOK0NCXJR3oiCKcPYrcGWAeIqs/Mg9Pte', 'Administrador General'),
        (2, 'empleado1', '$2b$10$qprHTjY81.orlLHOs0T6OOK0NCXJR3oiCKcPYrcGWAeIqs/Mg9Pte', 'Empleado Uno')`);
    
    console.log("✅ Datos default insertados");
}

// ===== MIDDLEWARES =====
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// =============================================
// ========== RUTAS DE PÁGINAS ================
// =============================================

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "roles.html")); });
app.get("/roles.html", (req, res) => { res.sendFile(path.join(__dirname, "roles.html")); });
app.get("/productos", (req, res) => { res.sendFile(path.join(__dirname, "productos.html")); });
app.get("/productos.html", (req, res) => { res.sendFile(path.join(__dirname, "productos.html")); });
app.get("/inventario", (req, res) => { res.sendFile(path.join(__dirname, "productos.html")); });
app.get("/index.html", (req, res) => { res.sendFile(path.join(__dirname, "productos.html")); });
app.get("/dashboard", (req, res) => { res.sendFile(path.join(__dirname, "index_admin.html")); });
app.get("/index_admin.html", (req, res) => { res.sendFile(path.join(__dirname, "index_admin.html")); });
app.get("/alertas", (req, res) => { res.sendFile(path.join(__dirname, "alertas.html")); });
app.get("/alertas.html", (req, res) => { res.sendFile(path.join(__dirname, "alertas.html")); });
app.get("/ventas", (req, res) => { res.sendFile(path.join(__dirname, "ventas.html")); });
app.get("/ventas.html", (req, res) => { res.sendFile(path.join(__dirname, "ventas.html")); });
app.get("/registro_ventas", (req, res) => { res.sendFile(path.join(__dirname, "registro_ventas.html")); });
app.get("/registro_ventas.html", (req, res) => { res.sendFile(path.join(__dirname, "registro_ventas.html")); });
app.get("/login_admin.html", (req, res) => { res.sendFile(path.join(__dirname, "login_admin.html")); });
app.get("/login_empleado.html", (req, res) => { res.sendFile(path.join(__dirname, "login_empleado.html")); });
app.get("/usuarios", (req, res) => { res.sendFile(path.join(__dirname, "usuarios.html")); });

// =============================================
// ========== RUTAS DE PRODUCTOS ===============
// =============================================

app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error("Error obteniendo productos:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

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

app.post('/api/products', (req, res) => {
    const { 
        codigo_barras, nombre, descripcion, categoria, 
        precio_compra, precio_venta, stock, stock_minimo, 
        unidad_medida, cantidad_por_unidad, proveedor, ubicacion, fecha_vencimiento,
        imagen
    } = req.body;
    
    let fechaFormateada = null;
    if (fecha_vencimiento) {
        const fecha = new Date(fecha_vencimiento);
        if (!isNaN(fecha.getTime())) {
            fechaFormateada = fecha.toISOString().split('T')[0];
        }
    }
    
    const sql = `INSERT INTO productos 
        (codigo_barras, nombre, descripcion, categoria, precio_compra, precio_venta, 
         stock, stock_minimo, unidad_medida, cantidad_por_unidad, proveedor, ubicacion, fecha_vencimiento, imagen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [
        codigo_barras, nombre, descripcion, categoria, 
        precio_compra || 0, precio_venta || 0, 
        stock || 0, stock_minimo || 5, 
        unidad_medida || 'Pieza', cantidad_por_unidad || 1, 
        proveedor, ubicacion, fechaFormateada,
        imagen || null
    ], (err, result) => {
        if (err) {
            console.error("Error creando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, id: result.insertId, message: "Producto creado exitosamente" });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && key !== 'stock') {
            if (key === 'fecha_vencimiento' && updates[key]) {
                const fecha = new Date(updates[key]);
                if (!isNaN(fecha.getTime())) {
                    const fechaFormateada = fecha.toISOString().split('T')[0];
                    fields.push(`${key}=?`);
                    values.push(fechaFormateada);
                } else {
                    fields.push(`${key}=?`);
                    values.push(null);
                }
            } else if (key === 'imagen') {
                fields.push(`${key}=?`);
                values.push(updates[key] || null);
            } else {
                fields.push(`${key}=?`);
                values.push(updates[key]);
            }
        }
    });
    
    if (fields.length === 0) {
        return res.status(400).json({ ok: false, error: "No hay campos para actualizar" });
    }
    
    values.push(id);
    const sql = `UPDATE productos SET ${fields.join(', ')} WHERE id=?`;
    
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error actualizando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Producto actualizado exitosamente" });
    });
});

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

app.get('/api/categories', (req, res) => {
    db.query('SELECT * FROM categorias ORDER BY nombre', (err, results) => {
        if (err) {
            console.error("Error obteniendo categorías:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

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

app.get('/api/batches', (req, res) => {
    const sql = `
        SELECT l.*, p.nombre as producto_nombre, p.codigo_barras, p.unidad_medida
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

app.post('/api/batches', (req, res) => {
    const { producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote } = req.body;
    
    if (!producto_id || !cantidad || !numero_lote) {
        return res.status(400).json({ ok: false, error: "Producto, cantidad y número de lote son obligatorios" });
    }
    
    let fechaFormateada = null;
    if (fecha_vencimiento) {
        const fecha = new Date(fecha_vencimiento);
        if (!isNaN(fecha.getTime())) {
            fechaFormateada = fecha.toISOString().split('T')[0];
        }
    }
    
    db.query('SELECT stock FROM productos WHERE id = ?', [producto_id], (err, productResult) => {
        if (err) {
            console.error("Error verificando producto:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        
        const existingStock = productResult[0]?.stock || 0;
        
        const sqlLote = `INSERT INTO lotes 
            (producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote) 
            VALUES (?, ?, ?, ?, ?)`;
        
        db.query(sqlLote, [producto_id, cantidad, fechaFormateada, precio_compra || null, numero_lote], (err, result) => {
            if (err) {
                console.error("Error insertando lote:", err);
                return res.status(500).json({ ok: false, error: err.message });
            }
            
            if (existingStock === 0) {
                db.query('UPDATE productos SET stock = ? WHERE id = ?', [cantidad, producto_id], (err) => {
                    if (err) console.error("Error asignando stock inicial:", err);
                });
            } else {
                db.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [cantidad, producto_id], (err) => {
                    if (err) console.error("Error sumando stock:", err);
                });
            }
            
            const sqlGetMinFecha = `SELECT MIN(fecha_vencimiento) as fecha_min FROM lotes WHERE producto_id = ? AND fecha_vencimiento IS NOT NULL`;
            db.query(sqlGetMinFecha, [producto_id], (err, fechaResult) => {
                if (err) {
                    console.error("Error obteniendo fecha mínima:", err);
                    return res.status(500).json({ ok: false, error: err.message });
                }
                const fechaMin = fechaResult[0]?.fecha_min || null;
                db.query('UPDATE productos SET fecha_vencimiento = ? WHERE id = ?', [fechaMin, producto_id], (err) => {
                    if (err) console.error("Error actualizando fecha:", err);
                    res.json({ ok: true, id: result.insertId, message: "Lote registrado exitosamente" });
                });
            });
        });
    });
});

app.put('/api/batches/:id', (req, res) => {
    const loteId = req.params.id;
    const { producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote } = req.body;
    
    let nuevaFechaFormateada = null;
    if (fecha_vencimiento) {
        const fecha = new Date(fecha_vencimiento);
        if (!isNaN(fecha.getTime())) {
            nuevaFechaFormateada = fecha.toISOString().split('T')[0];
        }
    }
    
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
            db.query(sqlUpdate, [cantidad, nuevaFechaFormateada, precio_compra || null, numero_lote, loteId], (err) => {
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
                        
                        const sqlGetMinFecha = `SELECT MIN(fecha_vencimiento) as fecha_min FROM lotes WHERE producto_id = ? AND fecha_vencimiento IS NOT NULL`;
                        db.query(sqlGetMinFecha, [producto_id], (err, result) => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error("Error obteniendo fecha mínima:", err);
                                    res.status(500).json({ ok: false, error: err.message });
                                });
                            }
                            const fechaMin = result[0]?.fecha_min || null;
                            db.query('UPDATE productos SET fecha_vencimiento = ? WHERE id = ?', [fechaMin, producto_id], (err) => {
                                if (err) {
                                    return db.rollback(() => {
                                        console.error("Error actualizando fecha del producto:", err);
                                        res.status(500).json({ ok: false, error: err.message });
                                    });
                                }
                                db.commit(err => {
                                    if (err) return db.rollback(() => res.status(500).json({ ok: false, error: err.message }));
                                    res.json({ ok: true, message: "Lote actualizado exitosamente" });
                                });
                            });
                        });
                    });
                } else {
                    const sqlGetMinFecha = `SELECT MIN(fecha_vencimiento) as fecha_min FROM lotes WHERE producto_id = ? AND fecha_vencimiento IS NOT NULL`;
                    db.query(sqlGetMinFecha, [producto_id], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error obteniendo fecha mínima:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        const fechaMin = result[0]?.fecha_min || null;
                        db.query('UPDATE productos SET fecha_vencimiento = ? WHERE id = ?', [fechaMin, producto_id], (err) => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error("Error actualizando fecha del producto:", err);
                                    res.status(500).json({ ok: false, error: err.message });
                                });
                            }
                            db.commit(err => {
                                if (err) return db.rollback(() => res.status(500).json({ ok: false, error: err.message }));
                                res.json({ ok: true, message: "Lote actualizado exitosamente" });
                            });
                        });
                    });
                }
            });
        });
    });
});

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
                
                const sqlGetMinFecha = `SELECT MIN(fecha_vencimiento) as fecha_min FROM lotes WHERE producto_id = ? AND fecha_vencimiento IS NOT NULL AND id != ?`;
                db.query(sqlGetMinFecha, [lote[0].producto_id, loteId], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error obteniendo fecha mínima:", err);
                            res.status(500).json({ ok: false, error: err.message });
                        });
                    }
                    const fechaMin = result[0]?.fecha_min || null;
                    db.query('UPDATE productos SET fecha_vencimiento = ? WHERE id = ?', [fechaMin, lote[0].producto_id], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error actualizando fecha del producto:", err);
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
    });
});

// =============================================
// ========== RUTAS DE VENTAS ==================
// =============================================

app.get('/api/tickets', (req, res) => {
    db.query('SELECT v.*, COUNT(dv.id) as cantidad_productos FROM venta v LEFT JOIN detalle_venta dv ON v.id = dv.id_venta GROUP BY v.id ORDER BY v.fecha_venta DESC', (err, results) => {
        if (err) {
            console.error("Error obteniendo tickets:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

app.get('/api/ventas/:id/detalle', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT dv.*, p.nombre, p.unidad_medida, p.cantidad_por_unidad
        FROM detalle_venta dv
        JOIN productos p ON dv.id_producto = p.id
        WHERE dv.id_venta = ?
    `;
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error obteniendo detalle de venta:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

app.post('/api/ventas', (req, res) => {
    const { folio, id_usuario, subtotal, iva, total, metodo_pago, detalle } = req.body;
    
    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
        
        const sqlVenta = `INSERT INTO venta (folio, id_usuario, subtotal, iva, total, metodo_pago) 
                          VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.query(sqlVenta, [folio, id_usuario || 2, subtotal, iva || 0, total, metodo_pago || 'efectivo'], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error insertando venta:", err);
                    res.status(500).json({ ok: false, error: err.message });
                });
            }
            
            const ventaId = result.insertId;
            let detalleCompletado = 0;
            let errorOcurrido = false;
            
            if (!detalle || detalle.length === 0) {
                return db.rollback(() => {
                    res.status(400).json({ ok: false, error: "No hay productos en la venta" });
                });
            }
            
            for (const item of detalle) {
                const sqlDetalle = `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal) 
                                    VALUES (?, ?, ?, ?, ?)`;
                
                db.query(sqlDetalle, [ventaId, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal], (err) => {
                    if (err || errorOcurrido) {
                        if (!errorOcurrido) {
                            errorOcurrido = true;
                            return db.rollback(() => {
                                console.error("Error insertando detalle de venta:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        return;
                    }
                    
                    db.query('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?', 
                        [item.cantidad, item.id_producto, item.cantidad], 
                        (err) => {
                            if (err || errorOcurrido) {
                                if (!errorOcurrido) {
                                    errorOcurrido = true;
                                    return db.rollback(() => {
                                        console.error("Error actualizando stock:", err);
                                        res.status(500).json({ ok: false, error: err.message });
                                    });
                                }
                                return;
                            }
                            
                            detalleCompletado++;
                            if (detalleCompletado === detalle.length && !errorOcurrido) {
                                db.commit(err => {
                                    if (err) {
                                        return db.rollback(() => {
                                            console.error("Error en commit:", err);
                                            res.status(500).json({ ok: false, error: err.message });
                                        });
                                    }
                                    res.json({ ok: true, id: ventaId, message: "Venta registrada exitosamente" });
                                });
                            }
                        }
                    );
                });
            }
        });
    });
});

app.post('/api/ventas/actualizar-stock', (req, res) => {
    const { productos } = req.body;
    
    if (!productos || !Array.isArray(productos)) {
        return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }
    
    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
        
        let completados = 0;
        let errores = [];
        
        for (const item of productos) {
            db.query('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?', 
                [item.cantidad, item.id, item.cantidad], 
                (err, result) => {
                    if (err) {
                        errores.push(err.message);
                    }
                    completados++;
                    
                    if (completados === productos.length) {
                        if (errores.length > 0) {
                            db.rollback(() => {
                                res.status(500).json({ ok: false, error: errores.join(', ') });
                            });
                        } else {
                            db.commit(err => {
                                if (err) {
                                    db.rollback(() => {
                                        res.status(500).json({ ok: false, error: err.message });
                                    });
                                } else {
                                    res.json({ ok: true, message: "Stock actualizado" });
                                }
                            });
                        }
                    }
                }
            );
        }
    });
});

// =============================================
// ========== RUTA PARA GUARDAR PDF ============
// =============================================

app.post('/api/guardar-pdf', upload.single('pdf'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No se recibió el archivo' });
        }
        
        console.log(`✅ PDF guardado en servidor: ${req.file.filename}`);
        res.json({ 
            ok: true, 
            message: 'PDF guardado exitosamente',
            path: `/tickets/${req.file.filename}`
        });
    } catch (error) {
        console.error('Error guardando PDF:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.get('/api/tickets-list', async (req, res) => {
    try {
        const files = await fs.readdir(ticketsDir);
        const pdfFiles = files.filter(f => f.endsWith('.pdf')).map(f => ({
            filename: f,
            path: `/tickets/${f}`,
            created: fs.statSync(path.join(ticketsDir, f)).birthtime
        }));
        res.json({ ok: true, data: pdfFiles });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.use('/tickets', express.static(ticketsDir));
app.use('/reportes', express.static(reportesDir));

// =============================================
// ========== RUTAS DE REPORTES ================
// =============================================

// Guardar reporte generado
app.post('/api/reportes/guardar', uploadReporte.single('reporte'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No se recibió el archivo' });
        }
        
        const { fecha_inicio, fecha_fin, periodo, total_ventas, monto_total, ganancia_total, productos_vendidos, generado_por } = req.body;
        
        const sql = `INSERT INTO reportes_ventas 
            (nombre_archivo, ruta_archivo, fecha_inicio, fecha_fin, periodo, total_ventas, monto_total, ganancia_total, productos_vendidos, generado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.query(sql, [
            req.file.filename,
            `/reportes/${req.file.filename}`,
            fecha_inicio,
            fecha_fin,
            periodo,
            total_ventas || 0,
            monto_total || 0,
            ganancia_total || 0,
            productos_vendidos || 0,
            generado_por || 'Sistema'
        ], (err, result) => {
            if (err) {
                console.error("Error guardando reporte:", err);
                return res.status(500).json({ ok: false, error: err.message });
            }
            
            console.log(`✅ Reporte guardado: ${req.file.filename}`);
            res.json({ 
                ok: true, 
                id: result.insertId,
                message: 'Reporte guardado exitosamente',
                path: `/reportes/${req.file.filename}`
            });
        });
    } catch (error) {
        console.error('Error guardando reporte:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Obtener todos los reportes guardados
app.get('/api/reportes', (req, res) => {
    const sql = `SELECT * FROM reportes_ventas ORDER BY fecha_generacion DESC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo reportes:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Eliminar reporte
app.delete('/api/reportes/:id', (req, res) => {
    const { id } = req.params;
    
    db.query('SELECT nombre_archivo, ruta_archivo FROM reportes_ventas WHERE id = ?', [id], (err, result) => {
        if (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
        if (result.length === 0) {
            return res.status(404).json({ ok: false, error: "Reporte no encontrado" });
        }
        
        const nombreArchivo = result[0].nombre_archivo;
        const rutaCompleta = path.join(reportesDir, nombreArchivo);
        
        fs.unlink(rutaCompleta, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error("Error eliminando archivo:", err);
            }
            
            db.query('DELETE FROM reportes_ventas WHERE id = ?', [id], (err) => {
                if (err) {
                    return res.status(500).json({ ok: false, error: err.message });
                }
                res.json({ ok: true, message: "Reporte eliminado exitosamente" });
            });
        });
    });
});

// =============================================
// ========== RUTAS DE AUTENTICACIÓN ===========
// =============================================

app.post("/login_admin", (req, res) => {
    loginGenerico("admin", req, res);
});

app.post("/login_empleado", (req, res) => {
    loginGenerico("empleado", req, res);
});

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

// =============================================
// ========== RUTAS DE USUARIOS ================
// =============================================

// Obtener todos los usuarios
app.get('/api/usuarios', (req, res) => {
    const sql = `
        SELECT u.id, u.id_rol, u.usuario, u.nombre_completo, u.email, u.telefono, 
               u.direccion, u.fecha_nacimiento, u.fecha_contratacion, u.activo,
               u.fecha_creacion, u.ultimo_acceso, r.nombre_rol as rol
        FROM usuarios u
        INNER JOIN roles r ON u.id_rol = r.id
        ORDER BY u.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error obteniendo usuarios:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Obtener roles
app.get('/api/roles', (req, res) => {
    db.query('SELECT * FROM roles ORDER BY id', (err, results) => {
        if (err) {
            console.error("Error obteniendo roles:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, data: results });
    });
});

// Crear nuevo usuario
app.post('/api/usuarios', async (req, res) => {
    const { 
        id_rol, usuario, password, nombre_completo, 
        email, telefono, direccion, fecha_nacimiento, fecha_contratacion 
    } = req.body;
    
    if (!usuario || !password || !nombre_completo || !id_rol) {
        return res.status(400).json({ ok: false, error: "Faltan campos obligatorios" });
    }
    
    if (usuario.length < 3) {
        return res.status(400).json({ ok: false, error: "El usuario debe tener al menos 3 caracteres" });
    }
    
    if (password.length < 4) {
        return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 4 caracteres" });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = `INSERT INTO usuarios 
            (id_rol, usuario, password, nombre_completo, email, telefono, direccion, fecha_nacimiento, fecha_contratacion, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        
        db.query(sql, [
            id_rol, usuario, hashedPassword, nombre_completo, 
            email || null, telefono || null, direccion || null, 
            fecha_nacimiento || null, fecha_contratacion || null
        ], (err, result) => {
            if (err) {
                console.error("Error creando usuario:", err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ ok: false, error: "El nombre de usuario ya existe" });
                }
                return res.status(500).json({ ok: false, error: err.message });
            }
            res.json({ ok: true, id: result.insertId, message: "Usuario creado exitosamente" });
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ ok: false, error: "Error interno del servidor" });
    }
});

// Actualizar usuario COMPLETO
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { id_rol, usuario, nombre_completo, email, telefono, direccion, fecha_nacimiento, fecha_contratacion, activo, password } = req.body;
    
    if (!id_rol || !nombre_completo || !usuario) {
        return res.status(400).json({ ok: false, error: "Faltan campos obligatorios" });
    }
    
    if (usuario.length < 3) {
        return res.status(400).json({ ok: false, error: "El usuario debe tener al menos 3 caracteres" });
    }
    
    let updateFields = [];
    let values = [];
    
    updateFields.push('id_rol = ?');
    values.push(id_rol);
    
    updateFields.push('usuario = ?');
    values.push(usuario);
    
    updateFields.push('nombre_completo = ?');
    values.push(nombre_completo);
    
    updateFields.push('email = ?');
    values.push(email || null);
    
    updateFields.push('telefono = ?');
    values.push(telefono || null);
    
    updateFields.push('direccion = ?');
    values.push(direccion || null);
    
    updateFields.push('fecha_nacimiento = ?');
    values.push(fecha_nacimiento || null);
    
    updateFields.push('fecha_contratacion = ?');
    values.push(fecha_contratacion || null);
    
    if (activo !== undefined) {
        updateFields.push('activo = ?');
        values.push(activo);
    }
    
    if (password && password.length > 0) {
        if (password.length < 4) {
            return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 4 caracteres" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        values.push(hashedPassword);
    }
    
    values.push(id);
    
    const sql = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error actualizando usuario:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ ok: false, error: "El nombre de usuario ya existe" });
            }
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Usuario actualizado exitosamente" });
    });
});

// Actualizar solo estado del usuario
app.put('/api/usuarios/:id/estado', (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    
    db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, id], (err) => {
        if (err) {
            console.error("Error actualizando estado del usuario:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.json({ ok: true, message: "Estado actualizado" });
    });
});

// Eliminar usuario
app.delete('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM usuarios WHERE id = ? AND usuario NOT IN ("douglas", "admin")', [id], (err, result) => {
        if (err) {
            console.error("Error eliminando usuario:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(400).json({ ok: false, error: "No se puede eliminar este usuario" });
        }
        res.json({ ok: true, message: "Usuario eliminado" });
    });
});

// =============================================
// ========== MANEJO DE ERRORES ================
// =============================================

app.use((req, res) => {
    res.status(404).json({
        error: "Ruta no encontrada",
        message: "La ruta solicitada no existe"
    });
});

process.on('uncaughtException', (err) => {
    console.error('❌ Error no capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesa rechazada no manejada:', err);
});

// =============================================
// ========== INICIAR SERVIDOR =================
// =============================================

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║   🚀 SERVIDOR CORRIENDO                           ║
    ╠═══════════════════════════════════════════════════╣
    ║   📍 URL: http://localhost:${PORT}                 ║
    ║   📄 Productos: /productos                        ║
    ║   📄 Dashboard: /dashboard                        ║
    ║   📄 Alertas: /alertas                            ║
    ║   📄 Ventas: /ventas                              ║
    ║   📄 Registro Ventas: /registro_ventas            ║
    ║   📄 Usuarios: /usuarios                          ║
    ║   📁 Tickets guardados en: ${ticketsDir}    ║
    ║   📁 Reportes guardados en: ${reportesDir}  ║
    ║   💵 Moneda: USD ($)                              ║
    ║   ✅ Productos: Se pueden eliminar (CASCADE)      ║
    ║   ✅ Fechas: Se actualizan al editar lote         ║
    ║   📸 Imágenes: Soporte para fotos opcionales      ║
    ║   🛒 Ventas: Punto de venta con tickets PDF       ║
    ║   💾 PDFs: Se guardan automáticamente en /tickets ║
    ║   👥 Usuarios: Gestión completa de usuarios       ║
    ║   🔧 CORREGIDO: Stock ya NO se duplica!           ║
    ║   ✏️  EDITAR USUARIO: Nombre de usuario editable   ║
    ║   📅 FECHAS: Nacimiento y contratación corregidas ║
    ║   📊 REPORTES: Guardados en DB y carpeta          ║
    ╚═══════════════════════════════════════════════════╝
    `);
});