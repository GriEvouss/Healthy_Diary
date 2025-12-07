// Конфигурация
const API_URL = 'http://localhost:3000/api';

// DOM элементы (будут инициализированы после загрузки DOM)
let symptomForm;
let medicationForm;
let intensitySlider;
let intensityValue;
let symptomsList;
let medicationsList;
let apiStatus;
let currentDateElement;
let authRequired;
let mainContent;
let userInfo;
let userName;

// ========== Функции для работы с токеном ==========

// Сохранение токена и информации о пользователе
function saveAuth(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    updateUI();
    // Загружаем данные ТОЛЬКО после успешной авторизации
    loadSymptoms();
    loadMedications();
}

// Получение токена из localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Получение информации о пользователе
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Удаление токена (выход)
function clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    updateUI();
}

// Проверка авторизации
function isAuthenticated() {
    return getAuthToken() !== null;
}

// Получение заголовков для авторизованных запросов
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Флаг для предотвращения повторных вызовов updateUI
let isUpdatingUI = false;

// Обновление UI в зависимости от статуса авторизации
// ВАЖНО: НЕ загружает данные автоматически - это делается отдельно после авторизации
function updateUI() {
    // Предотвращаем повторные вызовы
    if (isUpdatingUI) {
        return;
    }
    
    // Проверяем, что элементы загружены
    if (!authRequired || !mainContent) {
        return;
    }
    
    isUpdatingUI = true;
    
    const user = getUser();
    const authenticated = isAuthenticated();
    
    if (authenticated && user) {
        // Показываем дневник (основной контент)
        console.log('✅ Пользователь авторизован, показываем дневник');
        if (authRequired) authRequired.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        const mainNavbar = document.getElementById('main-navbar');
        if (mainNavbar) mainNavbar.style.display = 'block';
        if (userInfo) userInfo.style.display = 'block';
        if (userName) userName.textContent = user.full_name || user.email;
    } else {
        // Показываем страницу авторизации
        console.log('❌ Пользователь НЕ авторизован, показываем страницу авторизации');
        if (authRequired) {
            authRequired.style.display = 'block';
            console.log('✅ Страница авторизации показана');
        }
        if (mainContent) mainContent.style.display = 'none';
        const mainNavbar = document.getElementById('main-navbar');
        if (mainNavbar) mainNavbar.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
    }
    
    isUpdatingUI = false;
}

// ========== Функции аутентификации ==========

// Регистрация
async function register(e) {
    e.preventDefault();
    
    console.log('📝 Начало регистрации...');
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const full_name = document.getElementById('register-name').value;
    const errorDiv = document.getElementById('register-error');
    
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    // Валидация на клиенте
    if (!email || !password) {
        if (errorDiv) {
            errorDiv.textContent = 'Заполните все обязательные поля';
            errorDiv.style.display = 'block';
        }
        return;
    }
    
    if (password.length < 6) {
        if (errorDiv) {
            errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
            errorDiv.style.display = 'block';
        }
        return;
    }
    
    try {
        console.log('📤 Отправка запроса регистрации на:', `${API_URL}/auth/register`);
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, full_name })
        });
        
        console.log('📥 Получен ответ:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('📦 Данные ответа:', data);
        
        if (data.success) {
            // Сохраняем токен и информацию о пользователе
            saveAuth(data.data.token, data.data.user);
            
            // Очищаем форму
            const form = document.getElementById('register-form');
            if (form) {
                form.reset();
            }
            
            showNotification('Регистрация успешна! Добро пожаловать!', 'success');
        } else {
            if (errorDiv) {
                errorDiv.textContent = data.error || 'Ошибка при регистрации';
                errorDiv.style.display = 'block';
            }
            console.error('❌ Ошибка регистрации:', data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка регистрации (catch):', error);
        if (errorDiv) {
            errorDiv.textContent = `Ошибка подключения к серверу: ${error.message}`;
            errorDiv.style.display = 'block';
        }
        showNotification('Ошибка подключения к серверу. Проверьте консоль браузера.', 'error');
    }
}

// Вход
async function login(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Сохраняем токен и информацию о пользователе
            saveAuth(data.data.token, data.data.user);
            
            // Очищаем форму
            const form = document.getElementById('login-form');
            if (form) {
                form.reset();
            }
            
            showNotification('Вход выполнен успешно!', 'success');
        } else {
            errorDiv.textContent = data.error || 'Ошибка при входе';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        errorDiv.textContent = 'Ошибка подключения к серверу';
        errorDiv.style.display = 'block';
    }
}

// Выход
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        clearAuth();
        showNotification('Вы вышли из системы', 'info');
    }
}

// Проверка валидности токена при загрузке страницы
async function validateToken() {
    const token = getAuthToken();
    if (!token) {
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
            // Токен невалидный, очищаем
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            return false;
        }
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Обновляем информацию о пользователе
                localStorage.setItem('user', JSON.stringify(data.data));
                return true;
            }
        }
        
        return false;
    } catch (error) {
        // При ошибке сети считаем токен невалидным
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        return false;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация приложения...');
    
    // Инициализируем DOM элементы после загрузки страницы
    authRequired = document.getElementById('auth-required');
    mainContent = document.getElementById('main-content');
    userInfo = document.getElementById('user-info');
    userName = document.getElementById('user-name');
    currentDateElement = document.getElementById('current-date');
    apiStatus = document.getElementById('api-status');
    
    // Элементы форм (могут быть не найдены, если пользователь не авторизован)
    symptomForm = document.getElementById('symptom-form');
    medicationForm = document.getElementById('medication-form');
    intensitySlider = document.getElementById('symptom-intensity');
    intensityValue = document.getElementById('intensity-value');
    symptomsList = document.getElementById('symptoms-list');
    medicationsList = document.getElementById('medications-list');
    
    // Проверяем критичные элементы
    if (!authRequired) {
        console.error('❌ КРИТИЧНО: Элемент auth-required не найден!');
        return;
    }
    if (!mainContent) {
        console.error('❌ КРИТИЧНО: Элемент main-content не найден!');
        return;
    }
    
    console.log('✅ Критичные элементы найдены');
    
    // Установка текущей даты (только если элемент существует)
    if (currentDateElement) {
        updateCurrentDate();
    }
    
    // Обновление значения интенсивности (только если элементы существуют)
    if (intensitySlider && intensityValue) {
        intensitySlider.addEventListener('input', updateIntensityValue);
    }
    
    // Обработчики форм аутентификации (всегда должны быть на странице)
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', login);
        console.log('✅ Обработчик формы входа добавлен');
    } else {
        console.error('❌ Форма входа не найдена!');
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', register);
        console.log('✅ Обработчик формы регистрации добавлен');
    } else {
        console.error('❌ Форма регистрации не найдена!');
    }
    
    // Обработчики форм симптомов и лекарств (только если пользователь авторизован)
    if (symptomForm) {
        symptomForm.addEventListener('submit', addSymptom);
    }
    if (medicationForm) {
        medicationForm.addEventListener('submit', addMedication);
    }
    
    // Проверка статуса API (только если элемент существует)
    checkApiStatus();
    
    // Проверяем валидность токена при загрузке страницы
    if (isAuthenticated()) {
        console.log('🔍 Найден токен, проверяем валидность...');
        const isValid = await validateToken();
        if (isValid) {
            console.log('✅ Токен валиден, загружаем данные');
            loadSymptoms();
            loadMedications();
        } else {
            console.log('❌ Токен невалиден, очищен');
        }
    } else {
        console.log('ℹ️ Токен не найден, показываем страницу авторизации');
    }
    
    // Обновляем UI
    updateUI();
    console.log('✅ Инициализация завершена');
});

// Обновление текущей даты
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    currentDateElement.textContent = now.toLocaleDateString('ru-RU', options);
}

// Обновление значения интенсивности
function updateIntensityValue() {
    intensityValue.textContent = intensitySlider.value;
}

// Проверка статуса API
async function checkApiStatus() {
    // Проверяем, что элемент существует (он только в main-content)
    if (!apiStatus) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            apiStatus.innerHTML = `<span class="text-success">✓ Онлайн (${data.timestamp})</span>`;
        } else {
            apiStatus.innerHTML = '<span class="text-warning">⚠ Частично работает</span>';
        }
    } catch (error) {
        if (apiStatus) {
            apiStatus.innerHTML = '<span class="text-danger">✗ Офлайн</span>';
        }
        console.error('Ошибка подключения к API:', error);
    }
}

// Загрузка симптомов
async function loadSymptoms() {
    if (!isAuthenticated()) {
        console.log('⏭️ Пропускаем загрузку симптомов: пользователь не авторизован');
        return;
    }
    
    console.log('📥 Загрузка симптомов...');
    
    try {
        const response = await fetch(`${API_URL}/symptoms`, {
            headers: getAuthHeaders()
        });
        
        console.log('📥 Ответ загрузки симптомов:', response.status);
        
        if (response.status === 401 || response.status === 403) {
            // Токен недействителен
            console.log('❌ Токен недействителен при загрузке симптомов, очищаем авторизацию');
            clearAuth();
            // НЕ показываем уведомление, так как updateUI уже обновит интерфейс
            return;
        }
        
        if (!response.ok) {
            console.error('❌ Ошибка загрузки симптомов:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (data.data.length > 0) {
                document.getElementById('no-symptoms').style.display = 'none';
                symptomsList.innerHTML = '';
                
                // Данные уже отсортированы по дате DESC (новые сверху)
                data.data.forEach(symptom => {
                    addSymptomToTable(symptom, false); // false = append (добавляем в конец, так как данные уже отсортированы)
                });
            } else {
                document.getElementById('no-symptoms').style.display = '';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки симптомов:', error);
    }
}

// Добавление симптома
async function addSymptom(e) {
    e.preventDefault();
    
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему', 'warning');
        return;
    }
    
    const description = document.getElementById('symptom-description').value;
    const intensity = intensitySlider.value;
    
    try {
        const response = await fetch(`${API_URL}/symptoms`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                description,
                intensity
            })
        });
        
        if (response.status === 401) {
            clearAuth();
            showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'warning');
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showNotification(errorData.error || `Ошибка ${response.status}: ${response.statusText}`, 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // Скрываем сообщение "нет записей"
            const noSymptomsRow = document.getElementById('no-symptoms');
            if (noSymptomsRow) {
                noSymptomsRow.style.display = 'none';
            }
            
            // Перезагружаем данные для правильной сортировки по дате
            // Это гарантирует, что новая запись будет в правильном месте
            await loadSymptoms();
            
            // Сбрасываем форму
            symptomForm.reset();
            updateIntensityValue();
            
            // Показываем уведомление об успехе
            showNotification('Симптом добавлен успешно!', 'success');
        } else {
            showNotification(data.error || 'Ошибка при добавлении симптома', 'error');
        }
    } catch (error) {
        console.error('Ошибка добавления симптома:', error);
        showNotification('Ошибка при добавлении симптома. Проверьте подключение к серверу.', 'error');
    }
}

// Добавление симптома в таблицу
// prependToTop: true - добавить в начало (для новых записей), false - добавить в конец (при загрузке отсортированных данных)
function addSymptomToTable(symptom, prependToTop = true) {
    const row = document.createElement('tr');
    
    // Сохраняем дату для сортировки
    row.dataset.createdAt = new Date(symptom.created_at).getTime();
    
    // Форматируем дату (используем created_at из API)
    const date = new Date(symptom.created_at);
    const formattedDate = date.toLocaleDateString('ru-RU');
    const formattedTime = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Создаем индикатор интенсивности
    let intensityBadge = '';
    if (symptom.intensity <= 3) {
        intensityBadge = `<span class="badge bg-success">${symptom.intensity}/10</span>`;
    } else if (symptom.intensity <= 7) {
        intensityBadge = `<span class="badge bg-warning">${symptom.intensity}/10</span>`;
    } else {
        intensityBadge = `<span class="badge bg-danger">${symptom.intensity}/10</span>`;
    }
    
    row.innerHTML = `
        <td>
            <strong>${formattedDate}</strong><br>
            <small class="text-muted">${formattedTime}</small>
        </td>
        <td>${symptom.description}</td>
        <td>${intensityBadge}</td>
        <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteSymptom(${symptom.id})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    if (prependToTop) {
        // Добавляем в начало (для новых записей)
        symptomsList.prepend(row);
    } else {
        // Добавляем в конец (при загрузке уже отсортированных данных)
        symptomsList.appendChild(row);
    }
}

// Удаление симптома
async function deleteSymptom(id) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему', 'warning');
        return;
    }
    
    if (confirm('Удалить этот симптом?')) {
        try {
            const response = await fetch(`${API_URL}/symptoms/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                clearAuth();
                showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'warning');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                showNotification(errorData.error || `Ошибка ${response.status}: ${response.statusText}`, 'error');
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Удаляем из UI
                const symptomRows = document.querySelectorAll('#symptoms-list tr');
                symptomRows.forEach(row => {
                    if (row.innerHTML.includes(`deleteSymptom(${id})`)) {
                        row.remove();
                    }
                });
                
                showNotification('Симптом удалён', 'success');
                
                // Если нет больше симптомов, показываем сообщение
                if (symptomsList.children.length === 0) {
                    const noSymptomsRow = document.getElementById('no-symptoms');
                    if (noSymptomsRow) {
                        noSymptomsRow.style.display = '';
                    }
                }
            } else {
                showNotification(data.error || 'Ошибка при удалении', 'error');
            }
        } catch (error) {
            console.error('Ошибка удаления симптома:', error);
            showNotification('Ошибка при удалении', 'error');
        }
    }
}

// Загрузка лекарств
async function loadMedications() {
    if (!isAuthenticated()) {
        console.log('⏭️ Пропускаем загрузку лекарств: пользователь не авторизован');
        return;
    }
    
    console.log('📥 Загрузка лекарств...');
    
    try {
        const response = await fetch(`${API_URL}/medications`, {
            headers: getAuthHeaders()
        });
        
        console.log('📥 Ответ загрузки лекарств:', response.status);
        
        if (response.status === 401 || response.status === 403) {
            // Токен недействителен
            console.log('❌ Токен недействителен при загрузке лекарств, очищаем авторизацию');
            clearAuth();
            // НЕ показываем уведомление, так как updateUI уже обновит интерфейс
            return;
        }
        
        if (!response.ok) {
            console.error('❌ Ошибка загрузки лекарств:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (data.data.length > 0) {
                document.getElementById('no-medications').style.display = 'none';
                medicationsList.innerHTML = '';
                
                // Данные уже отсортированы по дате DESC (новые сверху)
                data.data.forEach(medication => {
                    addMedicationToTable(medication, false); // false = append (добавляем в конец, так как данные уже отсортированы)
                });
            } else {
                document.getElementById('no-medications').style.display = '';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки лекарств:', error);
    }
}

// Добавление лекарства
async function addMedication(e) {
    e.preventDefault();
    
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему', 'warning');
        return;
    }
    
    const name = document.getElementById('medication-name').value;
    const dosage = document.getElementById('medication-dosage').value;
    const time = document.getElementById('medication-time').value;
    
    // Формируем дату и время для taken_at
    const today = new Date();
    const [hours, minutes] = time.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const taken_at = today.toISOString();
    
    try {
        const response = await fetch(`${API_URL}/medications`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name,
                dosage,
                taken_at
            })
        });
        
        if (response.status === 401) {
            clearAuth();
            showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'warning');
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showNotification(errorData.error || `Ошибка ${response.status}: ${response.statusText}`, 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // Скрываем сообщение "нет записей"
            const noMedicationsRow = document.getElementById('no-medications');
            if (noMedicationsRow) {
                noMedicationsRow.style.display = 'none';
            }
            
            // Перезагружаем данные для правильной сортировки по дате
            // Это гарантирует, что новая запись будет в правильном месте
            await loadMedications();
            
            // Сбрасываем форму
            medicationForm.reset();
            
            // Показываем уведомление об успехе
            showNotification('Лекарство добавлено успешно!', 'success');
        } else {
            showNotification(data.error || 'Ошибка при добавлении лекарства', 'error');
        }
    } catch (error) {
        console.error('Ошибка добавления лекарства:', error);
        showNotification('Ошибка при добавлении лекарства. Проверьте подключение к серверу.', 'error');
    }
}

// Добавление лекарства в таблицу
// prependToTop: true - добавить в начало (для новых записей), false - добавить в конец (при загрузке отсортированных данных)
function addMedicationToTable(medication, prependToTop = true) {
    const row = document.createElement('tr');
    
    // Сохраняем дату для сортировки
    const medicationDate = new Date(medication.taken_at || medication.created_at);
    row.dataset.createdAt = medicationDate.getTime();
    
    // Форматируем дату (используем taken_at или created_at из API)
    const formattedDate = medicationDate.toLocaleDateString('ru-RU');
    const formattedTime = medicationDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    row.innerHTML = `
        <td>
            <strong>${formattedDate}</strong><br>
            <small class="text-muted">${formattedTime}</small>
        </td>
        <td>${medication.name}</td>
        <td>
            <span class="badge bg-primary">${medication.dosage || 'Не указано'}</span>
        </td>
        <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteMedication(${medication.id})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    if (prependToTop) {
        // Добавляем в начало (для новых записей)
        medicationsList.prepend(row);
    } else {
        // Добавляем в конец (при загрузке уже отсортированных данных)
        medicationsList.appendChild(row);
    }
}

// Удаление лекарства
async function deleteMedication(id) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему', 'warning');
        return;
    }
    
    if (confirm('Удалить запись о приёме лекарства?')) {
        try {
            const response = await fetch(`${API_URL}/medications/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                clearAuth();
                showNotification('Сессия истекла. Пожалуйста, войдите снова.', 'warning');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                showNotification(errorData.error || `Ошибка ${response.status}: ${response.statusText}`, 'error');
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Удаляем из UI
                const medicationRows = document.querySelectorAll('#medications-list tr');
                medicationRows.forEach(row => {
                    if (row.innerHTML.includes(`deleteMedication(${id})`)) {
                        row.remove();
                    }
                });
                
                showNotification('Запись удалена', 'success');
                
                // Если нет больше лекарств, показываем сообщение
                if (medicationsList.children.length === 0) {
                    const noMedicationsRow = document.getElementById('no-medications');
                    if (noMedicationsRow) {
                        noMedicationsRow.style.display = '';
                    }
                }
            } else {
                showNotification(data.error || 'Ошибка при удалении', 'error');
            }
        } catch (error) {
            console.error('Ошибка удаления лекарства:', error);
            showNotification('Ошибка при удалении', 'error');
        }
    }
}

// Вспомогательная функция для уведомлений
function showNotification(message, type = 'info') {
    // Создаем уведомление
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alert.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

// Экспортируем функции в глобальную область видимости
window.deleteSymptom = deleteSymptom;
window.deleteMedication = deleteMedication;
window.logout = logout;