const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});

// Cüzdan bakiye API rotasi
app.get('/api/wallet', (req, res) => {
  const fs = require('fs');
  try {
    const dbData = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    res.json({ balance: dbData.balance || 50.00 });
  } catch (err) {
    res.status(500).json({ error: 'Bakiye okunamadi' });
  }
});
