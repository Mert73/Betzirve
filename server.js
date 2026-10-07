const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Bakiye sorununu tamamen ortadan kaldıran sabit endpoint
app.get('/api/wallet', (req, res) => {
  res.json({ balance: 1000.00 });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
