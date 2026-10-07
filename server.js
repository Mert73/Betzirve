const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kullanıcı veritabanı simülasyonu
const users = {};

app.post('/api/login', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.json({ success: false, message: 'E-posta gerekli!' });
    }
    if (!users[email]) {
        users[email] = { email, balance: 1000.00 };
    }
    res.json({ success: true, user: users[email] });
});

app.get('/api/wallet', (req, res) => {
    const { email } = req.query;
    if (users[email]) {
        res.json({ balance: users[email].balance });
    } else {
        res.json({ balance: 1000.00 });
    }
});

// Doğrudan /games sayfasına gelen istekler için games.html sunumu
app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
