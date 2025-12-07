-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы симптомов
CREATE TABLE IF NOT EXISTS symptoms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы лекарств
CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(50),
    taken_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы настроек пользователя
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'ru',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставляем тестового пользователя (для демонстрации)
INSERT INTO users (email, password_hash, full_name) 
VALUES ('test@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeM1mBssMfX3N6LZeC5Z2pQ/3Yz5GJg8e', 'Тестовый Пользователь')
ON CONFLICT (email) DO NOTHING;

-- Вставляем демонстрационные симптомы (только если пользователь существует)
INSERT INTO symptoms (user_id, description, intensity, location, notes) 
SELECT 1, 'Головная боль', 7, 'Лобная часть', 'Началась после долгой работы за компьютером'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO symptoms (user_id, description, intensity, location, notes) 
SELECT 1, 'Насморк', 4, 'Нос', 'Сезонная аллергия'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO symptoms (user_id, description, intensity, location, notes) 
SELECT 1, 'Усталость', 6, 'Общее состояние', 'Не выспался'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

-- Вставляем демонстрационные лекарства (только если пользователь существует)
INSERT INTO medications (user_id, name, dosage, frequency, taken_at, notes) 
SELECT 1, 'Парацетамол', '500 мг', 'При необходимости', '2024-01-15 10:00:00', 'От головной боли'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO medications (user_id, name, dosage, frequency, taken_at, notes) 
SELECT 1, 'Цитрин', '10 мг', '1 раз в день', '2024-01-15 09:00:00', 'От аллергии'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

-- Создаем индексы для ускорения поиска
CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_created_at ON symptoms(created_at);