const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Basit kullanıcı veritabanı simülasyonu (Bellekte tutulur)
let users = {
    "demo@betzirve.com": { password: "123", balance: 1000.00, username: "Yaşar" }
};

// Giriş endpoint'i
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (users[email] && users[email].password === password) {
        res.json({ success: true, user: users[email] });
    } else {
        // Otomatik kayıt / misafir girişi desteği
        if (!users[email]) {
            users[email] = { password: password || "123", balance: 1000.00, username: email.split('@')[0] };
            return res.json({ success: true, user: users[email] });
        }
        res.status(401).json({ success: false, message: "Hatalı şifre!" });
    }
});

// Bakiye sorgulama
app.get('/api/wallet', (req, res) => {
    const email = req.query.email || "demo@betzirve.com";
    if (users[email]) {
        res.json({ balance: users[email].balance });
    } else {
        res.json({ balance: 1000.00 });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
