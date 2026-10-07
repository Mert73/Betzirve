const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
}

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const existingUser = data.users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Bu kullanıcı adı zaten alınmış.' });
    }

    data.users.push({ username, password });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, message: 'Kayıt başarılı!' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const user = data.users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: 'Hatalı kullanıcı adı veya şifre.' });
    }

    res.json({ success: true, message: 'Giriş başarılı!' });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
