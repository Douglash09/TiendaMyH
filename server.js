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
        if (err) {
            console.error("❌ Error creando tabla productos:", err.message);
        } else {
            console.log("✅ Tabla productos lista");
            agregarColumnaImagenSiNoExiste();
        }
    });
}

function agregarColumnaImagenSiNoExiste() {
    db.query("SHOW COLUMNS FROM productos LIKE 'imagen'", (err, result) => {
        if (err) {
            console.error("❌ Error verificando columna imagen:", err.message);
            return;
        }
        
        if (result.length === 0) {
            const sql = `ALTER TABLE productos ADD COLUMN imagen LONGTEXT`;
            db.query(sql, (err) => {
                if (err) {
                    console.error("❌ Error agregando columna imagen:", err.message);
                } else {
                    console.log("✅ Columna imagen agregada correctamente");
                }
            });
        } else {
            console.log("✅ Columna imagen ya existe");
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
            INDEX idx_numero_lote (numero_lote),
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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

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
            } else if (key !== 'formato_venta' && key !== 'cantidad_formato' && key !== 'stock') {
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
    
    const sqlLote = `INSERT INTO lotes 
        (producto_id, cantidad, fecha_vencimiento, precio_compra, numero_lote) 
        VALUES (?, ?, ?, ?, ?)`;
    
    db.query(sqlLote, [producto_id, cantidad, fechaFormateada, precio_compra || null, numero_lote], (err, result) => {
        if (err) {
            console.error("Error insertando lote:", err);
            return res.status(500).json({ ok: false, error: err.message });
        }
        
        const sqlUpdateFecha = `UPDATE productos SET fecha_vencimiento = ? 
            WHERE id = ? AND (fecha_vencimiento IS NULL OR fecha_vencimiento > ?)`;
        db.query(sqlUpdateFecha, [fechaFormateada, producto_id, fechaFormateada], (err) => {
            if (err) {
                console.error("Error actualizando fecha:", err);
                return res.status(500).json({ ok: false, error: err.message });
            }
            res.json({ ok: true, id: result.insertId, message: "Lote registrado exitosamente" });
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
                
                const sqlGetMinFecha = `SELECT MIN(fecha_vencimiento) as fecha_min FROM lotes WHERE producto_id = ? AND fecha_vencimiento IS NOT NULL`;
                db.query(sqlGetMinFecha, [lote[0].producto_id], (err, result) => {
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

// =============================================
// ========== RUTAS DE VENTAS ==================
// =============================================

app.get('/api/ventas', (req, res) => {
    db.query('SELECT * FROM venta ORDER BY fecha_venta DESC', (err, results) => {
        if (err) {
            console.error("Error obteniendo ventas:", err);
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
        
        db.query(sqlVenta, [folio, id_usuario, subtotal, iva, total, metodo_pago || 'efectivo'], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error insertando venta:", err);
                    res.status(500).json({ ok: false, error: err.message });
                });
            }
            
            const ventaId = result.insertId;
            let detalleCompletado = 0;
            
            for (const item of detalle) {
                const sqlDetalle = `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal) 
                                    VALUES (?, ?, ?, ?, ?)`;
                
                db.query(sqlDetalle, [ventaId, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error insertando detalle de venta:", err);
                            res.status(500).json({ ok: false, error: err.message });
                        });
                    }
                    
                    db.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.id_producto], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error actualizando stock:", err);
                                res.status(500).json({ ok: false, error: err.message });
                            });
                        }
                        
                        detalleCompletado++;
                        if (detalleCompletado === detalle.length) {
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
                    });
                });
            }
        });
    });
});

// =============================================
// ========== RUTAS DE AUTENTICACIÓN ===========
// =============================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "roles.html"));
});

app.get("/gestion", (req, res) => {
    res.sendFile(path.join(__dirname, "gestion.html"));
});

app.get("/alerta", (req, res) => {
    res.sendFile(path.join(__dirname, "alerta.html"));
});

app.get("/inventario", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/productos", (req, res) => {
    res.sendFile(path.join(__dirname, "productos.html"));
});

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

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║   🚀 SERVIDOR CORRIENDO                           ║
    ╠═══════════════════════════════════════════════════╣
    ║   📍 URL: http://localhost:${PORT}                 ║
    ║   📄 Productos: /productos                        ║
    ║   📄 Dashboard: /dashboard                        ║
    ║   📄 Alertas: /alerta                             ║
    ║   💵 Moneda: USD ($)                              ║
    ║   ✅ Productos: Se pueden eliminar (CASCADE)      ║
    ║   ✅ Fechas: Se actualizan al editar lote         ║
    ║   📸 Imágenes: Soporte para fotos opcionales      ║
    ╚═══════════════════════════════════════════════════╝
    `);
});