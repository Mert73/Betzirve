const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/wallet', (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'database.json');
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ balance: 50.00 }, null, 2));
    }
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    res.json({ balance: dbData.balance !== undefined ? dbData.balance : 50.00 });
  } catch (err) {
    res.status(500).json({ error: 'Bakiye okunamadi' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
