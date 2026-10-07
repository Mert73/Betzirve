const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Bellek içi kullanıcı ve oda veritabanı simülasyonu
const users = []; // { email, password, name, balance }
let rooms = [
    { id: '1', name: '🎧 Müzik Keyfi & Sohbet', host: 'Ahmet', count: 6 },
    { id: '2', name: '✨ Gecenin Yıldızları', host: 'Zeynep', count: 4 }
];

// Kayıt Ol API
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Tüm alanları doldurunuz!' });
    }
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.json({ success: false, message: 'Bu e-posta zaten kayıtlı!' });
    }
    
    const newUser = { name, email, password, balance: 1000.00 };
    users.push(newUser);
    res.json({ success: true, user: { name: newUser.name, email: newUser.email, balance: newUser.balance } });
});

// Giriş Yap API
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.json({ success: false, message: 'E-posta veya şifre hatalı!' });
    }
    res.json({ success: true, user: { name: user.name, email: user.email, balance: user.balance } });
});

// Odaları listele
app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});

// Yeni oda oluştur
app.post('/api/create-room', (req, res) => {
    const { name, host } = req.body;
    if (!name) return res.json({ success: false, message: 'Oda adı gerekli!' });
    
    const newRoom = { id: Date.now().toString(), name, host: host || 'Misafir', count: 1 };
    rooms.push(newRoom);
    res.json({ success: true, room: newRoom });
});

// WebSocket Yönetimi
io.on('connection', (socket) => {
    socket.on('join-room', (roomName) => {
        socket.join(roomName);
    });

    socket.on('chat-message', (data) => {
        io.to(data.room).emit('chat-message', data);
    });

    socket.on('send-gift', (data) => {
        io.to(data.room).emit('send-gift', data);
    });
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/rooms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rooms.html')));
app.get('/room', (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
