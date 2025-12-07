const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Настройка подключения к PostgreSQL
// Поддержка DATABASE_URL из docker-compose.yml
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'healthdb',
      user: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'pass',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

// Проверка подключения к БД
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
  } else {
    console.log('✅ Подключение к PostgreSQL установлено');
    release();
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Проверка API
app.get('/', (req, res) => {
  res.json({
    message: 'API Дневника Здоровья',
    version: process.env.APP_VERSION || '1.0.0',
    status: 'работает',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    endpoints: {
      health: '/api/health',
      symptoms: {
        getAll: 'GET /api/symptoms',
        create: 'POST /api/symptoms'
      },
      medications: {
        getAll: 'GET /api/medications',
        create: 'POST /api/medications'
      }
    }
  });
});

// ========== Middleware для проверки авторизации ==========

// Функция для проверки JWT токена
const authenticateToken = (req, res, next) => {
  // Получаем токен из заголовка Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Формат: "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Токен доступа не предоставлен'
    });
  }
  
  // Проверяем токен
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Недействительный или истекший токен'
      });
    }
    
    // Сохраняем информацию о пользователе в запросе
    req.user = user;
    next();
  });
};

// ========== API для аутентификации ==========

// Регистрация нового пользователя
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  
  // Валидация входных данных
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email и пароль обязательны'
    });
  }
  
  // Проверка формата email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Некорректный формат email'
    });
  }
  
  // Проверка длины пароля
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Пароль должен содержать минимум 6 символов'
    });
  }
  
  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Пользователь с таким email уже существует'
      });
    }
    
    // Хешируем пароль
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Создаем нового пользователя
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, full_name, created_at`,
      [email, password_hash, full_name || null]
    );
    
    const user = result.rows[0];
    
    // Создаем JWT токен
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' } // Токен действителен 7 дней
    );
    
    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name
        },
        token: token
      }
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при регистрации'
    });
  }
});

// Вход пользователя
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Валидация
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email и пароль обязательны'
    });
  }
  
  try {
    // Ищем пользователя по email
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Неверный email или пароль'
      });
    }
    
    const user = result.rows[0];
    
    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Неверный email или пароль'
      });
    }
    
    // Создаем JWT токен
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name
        },
        token: token
      }
    });
  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при входе'
    });
  }
});

// Получение информации о текущем пользователе
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при получении информации о пользователе:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера'
    });
  }
});

// Проверка здоровья системы
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW() as time, version() as version');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'health-diary-api',
      database: {
        status: 'connected',
        time: dbResult.rows[0].time,
        version: dbResult.rows[0].version.split(' ').slice(0, 4).join(' ')
      },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected'
    });
  }
});

// ========== API для симптомов ==========

// Получить все симптомы текущего пользователя
app.get('/api/symptoms', authenticateToken, async (req, res) => {
  try {
    // Фильтруем симптомы только для текущего пользователя
    const result = await pool.query(`
      SELECT s.* 
      FROM symptoms s
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 100
    `, [req.user.id]);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Ошибка при получении симптомов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении симптомов'
    });
  }
});

// Создать новый симптом
app.post('/api/symptoms', authenticateToken, async (req, res) => {
  const { description, intensity, location, notes } = req.body;
  
  // Валидация
  if (!description || description.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Описание симптома обязательно'
    });
  }
  
  if (intensity && (intensity < 1 || intensity > 10)) {
    return res.status(400).json({
      success: false,
      error: 'Интенсивность должна быть от 1 до 10'
    });
  }
  
  try {
    // Используем user_id из токена (авторизованный пользователь)
    const result = await pool.query(
      `INSERT INTO symptoms (user_id, description, intensity, location, notes) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.user.id, description.trim(), intensity || 5, location || '', notes || '']
    );
    
    res.status(201).json({
      success: true,
      message: 'Симптом успешно добавлен',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при добавлении симптома:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при добавлении симптома'
    });
  }
});

// Удалить симптом
app.delete('/api/symptoms/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Удаляем только если симптом принадлежит текущему пользователю
    const result = await pool.query(
      'DELETE FROM symptoms WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Симптом не найден или у вас нет прав на его удаление'
      });
    }
    
    res.json({
      success: true,
      message: 'Симптом успешно удален'
    });
  } catch (error) {
    console.error('Ошибка при удалении симптома:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении симптома'
    });
  }
});

// ========== API для лекарств ==========

// Получить все лекарства текущего пользователя
app.get('/api/medications', authenticateToken, async (req, res) => {
  try {
    // Фильтруем лекарства только для текущего пользователя
    // Сортируем по taken_at (если есть) или created_at в порядке убывания (новые сверху)
    const result = await pool.query(`
      SELECT m.* 
      FROM medications m
      WHERE m.user_id = $1
      ORDER BY COALESCE(m.taken_at, m.created_at) DESC
      LIMIT 100
    `, [req.user.id]);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Ошибка при получении лекарств:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении лекарств'
    });
  }
});

// Создать новое лекарство
app.post('/api/medications', authenticateToken, async (req, res) => {
  const { name, dosage, frequency, taken_at, notes } = req.body;
  
  // Валидация
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Название лекарства обязательно'
    });
  }
  
  try {
    // Используем user_id из токена (авторизованный пользователь)
    const result = await pool.query(
      `INSERT INTO medications (user_id, name, dosage, frequency, taken_at, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        req.user.id, 
        name.trim(), 
        dosage || '', 
        frequency || '', 
        taken_at || new Date(), 
        notes || ''
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Лекарство успешно добавлено',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при добавлении лекарства:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при добавлении лекарства'
    });
  }
});

// Удалить лекарство
app.delete('/api/medications/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Удаляем только если лекарство принадлежит текущему пользователю
    const result = await pool.query(
      'DELETE FROM medications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Лекарство не найдено или у вас нет прав на его удаление'
      });
    }
    
    res.json({
      success: true,
      message: 'Лекарство успешно удалено'
    });
  } catch (error) {
    console.error('Ошибка при удалении лекарства:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении лекарства'
    });
  }
});

// ========== Статистика ==========

// Получить статистику текущего пользователя
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const symptomsCount = await pool.query(
      'SELECT COUNT(*) FROM symptoms WHERE user_id = $1',
      [userId]
    );
    const medicationsCount = await pool.query(
      'SELECT COUNT(*) FROM medications WHERE user_id = $1',
      [userId]
    );
    
    // Статистика по интенсивности симптомов (только для текущего пользователя)
    const intensityStats = await pool.query(`
      SELECT 
        intensity,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM symptoms 
      WHERE intensity IS NOT NULL AND user_id = $1
      GROUP BY intensity 
      ORDER BY intensity
    `, [userId]);
    
    // Последние добавленные записи (только для текущего пользователя)
    const recentSymptoms = await pool.query(`
      SELECT description, intensity, created_at 
      FROM symptoms 
      WHERE user_id = $1
      ORDER BY created_at DESC 
      LIMIT 5
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        counts: {
          symptoms: parseInt(symptomsCount.rows[0].count),
          medications: parseInt(medicationsCount.rows[0].count)
        },
        intensityStats: intensityStats.rows,
        recentSymptoms: recentSymptoms.rows,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики'
    });
  }
});

// ========== Обработка ошибок ==========

// 404 - Не найден
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ресурс не найден'
  });
});

// Обработка ошибок сервера
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========== Запуск сервера ==========

const server = app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступно по адресу: http://localhost:${PORT}`);
  console.log(`🗄️  База данных: PostgreSQL (healthdb)`);
  console.log(`🌐 Frontend: http://localhost:8080`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Получен сигнал SIGTERM. Закрытие сервера...');
  server.close(() => {
    console.log('👋 Сервер остановлен');
    pool.end();
    process.exit(0);
  });
});