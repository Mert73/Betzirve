const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Kalıcı Veritabanı Dosyası (Veriler diskte saklanır, silinmez)
const DB_FILE = path.join(__dirname, "database.json");

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        let initialData = { users: [], sessions: {}, supportMsgs: [
            { sender: "Müşteri Temsilcisi (Can)", text: "Merhaba BetZirve'ye hoş geldiniz! Canlı sisteme geçiş yaptık, nasıl yardımcı olabilirim?", time: "21:00" }
        ]};
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Canlı Maç Veritabanı
const allMatches = [
    { id: 1, league: "Türkiye Süper Lig", match: "Galatasaray - Fenerbahçe", minute: "81'", score: "2 - 1", odds: { ms1: 1.90, "0": 3.50, ms2: 3.40 } },
    { id: 2, league: "Türkiye Süper Lig", match: "Beşiktaş - Trabzonspor", minute: "45+'", score: "1 - 0", odds: { ms1: 2.05, "0": 3.30, ms2: 3.10 } },
    { id: 3, league: "İngiltere Premier Lig", match: "Manchester City - Arsenal", minute: "73'", score: "2 - 2", odds: { ms1: 2.10, "0": 3.40, ms2: 2.90 } },
    { id: 4, league: "İngiltere Premier Lig", match: "Liverpool - Manchester United", minute: "15'", score: "0 - 0", odds: { ms1: 1.75, "0": 3.80, ms2: 4.20 } },
    { id: 5, league: "İspanya La Liga", match: "Real Madrid - Barcelona", minute: "90+'", score: "3 - 2", odds: { ms1: 2.30, "0": 3.40, ms2: 2.70 } },
    { id: 6, league: "İspanya La Liga", match: "Atletico Madrid - Valencia", minute: "55'", score: "1 - 0", odds: { ms1: 1.60, "0": 3.60, ms2: 5.00 } },
    { id: 7, league: "İtalya Serie A", match: "Inter - Juventus", minute: "32'", score: "0 - 1", odds: { ms1: 2.20, "0": 3.10, ms2: 3.00 } },
    { id: 8, league: "UEFA Şampiyonlar Ligi", match: "Bayern Münih - PSG", minute: "64'", score: "1 - 1", odds: { ms1: 2.15, "0": 3.50, ms2: 2.85 } }
];

// Kayıt Ol
app.post("/api/auth/register", (req, res) => {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Kullanıcı adı ve şifre zorunludur!" });
    
    let db = loadDB();
    let existing = db.users.find(u => u.username === username);
    if (existing) return res.status(400).json({ success: false, message: "Bu kullanıcı adı zaten alınmış!" });
    
    db.users.push({
        username,
        password,
        balance: 1000.00,
        coupons: [],
        transactions: []
    });
    saveDB(db);
    res.json({ success: true, message: "Kayıt başarılı! Giriş yapabilirsiniz." });
});

// Giriş Yap
app.post("/api/auth/login", (req, res) => {
    let { username, password } = req.body;
    let db = loadDB();
    let user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ success: false, message: "Hatalı kullanıcı adı veya şifre!" });
    
    let token = "token_" + username + "_" + Date.now();
    db.sessions[token] = username;
    saveDB(db);
    res.json({ success: true, token, username });
});

// Kullanıcı Bilgileri
app.get("/api/user", (req, res) => {
    let token = req.headers.authorization;
    let db = loadDB();
    let username = db.sessions[token];
    if (!username) return res.status(401).json({ success: false, message: "Oturum açılmadı" });
    
    let user = db.users.find(u => u.username === username);
    res.json({ success: true, balance: user.balance, coupons: user.coupons, username: user.username });
});

// Para Yatırma
app.post("/api/wallet/deposit", (req, res) => {
    let token = req.headers.authorization;
    let db = loadDB();
    let username = db.sessions[token];
    if (!username) return res.status(401).json({ success: false, message: "Oturum açılmadı" });

    let amount = parseFloat(req.body.amount);
    let user = db.users.find(u => u.username === username);

    if (amount && amount > 0) {
        user.balance += amount;
        user.transactions.push({ type: "Yatırım", amount: amount, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
        saveDB(db);
        res.json({ success: true, balance: user.balance });
    } else {
        res.status(400).json({ success: false, message: "Geçersiz tutar" });
    }
});

// Kupon Oynama
app.post("/api/bet/play", (req, res) => {
    let token = req.headers.authorization;
    let db = loadDB();
    let username = db.sessions[token];
    if (!username) return res.status(401).json({ success: false, message: "Oturum açılmadı" });

    let { matchId, selection, odd, stake } = req.body;
    stake = parseFloat(stake);
    let user = db.users.find(u => u.username === username);
    
    if (!stake || stake <= 0) return res.status(400).json({ success: false, message: "Geçersiz miktar" });
    if (user.balance < stake) return res.status(400).json({ success: false, message: "Yetersiz bakiye!" });

    let match = allMatches.find(m => m.id == matchId);
    if (!match) return res.status(404).json({ success: false, message: "Maç bulunamadı" });

    user.balance -= stake;
    let possibleWin = (stake * odd).toFixed(2);
    
    user.coupons.unshift({
        id: Date.now(),
        match: match.match,
        selection: selection,
        odd: odd,
        stake: stake,
        possibleWin: possibleWin,
        status: "Aktif (Bekliyor)",
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    saveDB(db);
    res.json({ success: true, balance: user.balance, coupons: user.coupons });
});

app.get("/api/live/odds", (req, res) => {
    let leagueFilter = req.query.league;
    let search = req.query.search ? req.query.search.toLowerCase() : "";
    let filtered = allMatches.filter(m => {
        let matchLeague = !leagueFilter || leagueFilter === "Tümü" || m.league === leagueFilter;
        let matchSearch = !search || m.match.toLowerCase().includes(search) || m.league.toLowerCase().includes(search);
        return matchLeague && matchSearch;
    });
    res.json(filtered);
});

app.get("/api/slots", (req, res) => {
    res.json([
        { id: 1, name: "Gates of Olympus", provider: "Pragmatic Play", rtp: "%96.5", image: "⚡" },
        { id: 2, name: "Sweet Bonanza", provider: "Pragmatic Play", rtp: "%96.48", image: "🍬" },
        { id: 3, name: "Starlight Princess", provider: "Pragmatic Play", rtp: "%96.5", image: "✨" },
        { id: 4, name: "Aviator", provider: "Spribe", rtp: "%97.0", image: "✈️" },
        { id: 5, name: "Book of Dead", provider: "Play'n GO", rtp: "%96.2", image: "📚" },
        { id: 6, name: "Crazy Time", provider: "Evolution", rtp: "%96.08", image: "🎡" }
    ]);
});

app.get("/api/support/messages", (req, res) => {
    let db = loadDB();
    res.json(db.supportMsgs);
});

app.post("/api/support/send", (req, res) => {
    let userText = req.body.message;
    if (userText) {
        let db = loadDB();
        db.supportMsgs.push({ sender: "Siz", text: userText, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
        setTimeout(() => {
            let currentDb = loadDB();
            let reply = "Canlı destek ekibimiz talebinizi inceliyor...";
            let lower = userText.toLowerCase();
            if (lower.includes("para") || lower.includes("yatırım")) {
                reply = "Yatırım işlemleriniz otomatik onaylanmaktadır.";
            }
            currentDb.supportMsgs.push({ sender: "Müşteri Temsilcisi (Can)", text: reply, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
            saveDB(currentDb);
        }, 1000);
        saveDB(db);
    }
    res.json({ success: true });
});

app.get("/", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BetZirve - Canlı Bahis ve Casino</title>
        <style>
            body { background: #0b0c10; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; padding-bottom: 60px; }
            header { background: #12131c; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2130; position: sticky; top: 0; z-index: 100; }
            .logo { font-size: 18px; font-weight: bold; color: #e50914; display: flex; align-items: center; gap: 5px; }
            .wallet-box { display: flex; align-items: center; gap: 8px; }
            .balance-display { background: #1a1c29; padding: 6px 12px; border-radius: 6px; font-size: 13px; border: 1px solid #2a2d42; }
            .balance { color: #2ecc71; font-weight: bold; }
            .btn-deposit { background: #2ecc71; color: #0b0c10; border: none; padding: 7px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .btn-logout { background: #e50914; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; }

            #auth-container { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0b0c10; z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 15px; }
            .auth-box { background: #12131c; border: 1px solid #2a2d42; padding: 25px; border-radius: 12px; width: 100%; max-width: 340px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
            .auth-input { padding: 10px; background: #1a1c29; border: 1px solid #2a2d42; color: #fff; border-radius: 6px; font-size: 13px; }
            .auth-btn { background: #e50914; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
            .auth-switch { text-align: center; font-size: 12px; color: #8a8bc0; cursor: pointer; margin-top: 5px; }

            .nav-tabs { display: flex; background: #12131c; padding: 8px 15px; gap: 10px; overflow-x: auto; border-bottom: 1px solid #1f2130; white-space: nowrap; }
            .tab-btn { background: #1a1c29; border: 1px solid #2a2d42; color: #b8b9cc; padding: 6px 14px; border-radius: 20px; font-size: 12px; cursor: pointer; }
            .tab-btn.active { background: #e50914; color: white; border-color: #e50914; font-weight: bold; }

            .container { padding: 12px; max-width: 900px; margin: 0 auto; display: none; }
            .search-bar { width: 100%; padding: 10px 15px; background: #12131c; border: 1px solid #2a2d42; border-radius: 8px; color: #fff; font-size: 13px; margin-bottom: 12px; box-sizing: border-box; }
            .section-title { font-size: 15px; font-weight: bold; margin: 15px 0 10px 0; color: #e4e5f1; display: flex; align-items: center; justify-content: space-between; }
            
            .match-card { background: #12131c; border: 1px solid #1f2130; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
            .match-header { display: flex; justify-content: space-between; font-size: 11px; color: #8a8bc0; margin-bottom: 5px; }
            .match-body { display: flex; justify-content: space-between; align-items: center; }
            .match-teams { font-size: 13px; font-weight: bold; }
            .match-score { background: #e50914; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px; }
            
            .odds-group { display: flex; gap: 4px; }
            .odd-btn { background: #1a1c29; border: 1px solid #2a2d42; color: #fff; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; text-align: center; min-width: 32px; }
            .odd-btn.selected { background: #e50914; border-color: #e50914; font-weight: bold; }

            .slots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .slot-item { background: #12131c; border: 1px solid #1f2130; border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; }
            
            #bet-slip { position: fixed; bottom: 0; left: 0; right: 0; background: #12131c; border-top: 2px solid #e50914; padding: 12px; z-index: 998; display: none; box-shadow: 0 -5px 20px rgba(0,0,0,0.8); }
            .slip-content { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }

            .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center; }
            .modal-content { background: #12131c; border: 1px solid #2a2d42; padding: 20px; border-radius: 10px; width: 300px; display: flex; flex-direction: column; gap: 12px; }
            
            #support-box { display: none; position: fixed; bottom: 75px; right: 15px; width: 310px; height: 380px; background: #12131c; border: 1px solid #2a2d42; border-radius: 10px; flex-direction: column; overflow: hidden; z-index: 9999; box-shadow: 0 5px 20px rgba(0,0,0,0.6); }
            #chat-messages { flex: 1; padding: 10px; overflow-y: auto; background: #0b0c10; font-size: 12px; display: flex; flex-direction: column; gap: 8px; }
            .btn-support { position: fixed; bottom: 15px; right: 15px; background: #e50914; color: white; border: none; border-radius: 50px; padding: 10px 18px; font-weight: bold; cursor: pointer; z-index: 9999; box-shadow: 0 4px 12px rgba(229,9,20,0.4); font-size: 13px; display: flex; align-items: center; gap: 6px; }
        </style>
    </head>
    <body>

        <div id="auth-container">
            <div class="auth-box">
                <div style="text-align:center; font-size:20px; font-weight:bold; color:#e50914;">⚡ BETZİRVE (Canlı DB)</div>
                <div id="auth-title" style="text-align:center; font-size:14px; font-weight:bold;">Hesabınıza Giriş Yapın</div>
                <input type="text" id="auth-username" class="auth-input" placeholder="Kullanıcı Adı" />
                <input type="password" id="auth-password" class="auth-input" placeholder="Şifre" />
                <button class="auth-btn" id="auth-submit-btn" onclick="handleAuth()">Giriş Yap</button>
                <div class="auth-switch" id="auth-switch-text" onclick="toggleAuthMode()">Hesabın yok mu? Kayıt Ol</div>
            </div>
        </div>

        <div id="main-app">
            <header>
                <div class="logo">⚡ BETZİRVE (<span id="logged-user" style="font-size:12px; color:#fff;"></span>)</div>
                <div class="wallet-box">
                    <div class="balance-display">Bakiye: <span class="balance" id="user-balance">0.00</span> TL</div>
                    <button class="btn-deposit" onclick="openDepositModal()">+ Para Yatır</button>
                    <button class="btn-logout" onclick="logout()">Çıkış</button>
                </div>
            </header>

            <div class="nav-tabs">
                <button class="tab-btn active" onclick="filterLeague('Tümü', this)">Tüm Maçlar</button>
                <button class="tab-btn" onclick="filterLeague('Türkiye Süper Lig', this)">🇹🇷 Süper Lig</button>
                <button class="tab-btn" onclick="filterLeague('İngiltere Premier Lig', this)">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier Lig</button>
                <button class="tab-btn" onclick="filterLeague('İspanya La Liga', this)">🇪🇸 La Liga</button>
                <button class="tab-btn" onclick="filterLeague('İtalya Serie A', this)">🇮🇹 Serie A</button>
                <button class="tab-btn" onclick="filterLeague('UEFA Şampiyonlar Ligi', this)">🇪🇺 Şampiyonlar Ligi</button>
            </div>

            <div class="container" id="app-container" style="display: block;">
                <input type="text" class="search-bar" id="search-input" placeholder="Takım veya lig ara..." oninput="fetchOdds()" />

                <div class="section-title">
                    <span>🔴 Canlı Bahis Bülteni</span>
                    <span style="font-size: 11px; color: #8a8bc0;" id="match-count">0 Maç</span>
                </div>
                <div id="odds-list">Yükleniyor...</div>

                <div class="section-title"><span>🎰 Canlı Casino & Slotlar</span></div>
                <div class="slots-grid" id="slots-list">Yükleniyor...</div>

                <div class="section-title"><span>📜 Oynanan Kuponlarım</span></div>
                <div id="user-coupons" style="background:#12131c; border:1px solid #1f2130; border-radius:8px; padding:10px; font-size:12px; color:#aaa;">
                    Henüz kupon yapılmadı.
                </div>
            </div>
        </div>

        <div id="bet-slip">
            <div class="slip-content">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:bold;">
                    <span>🎫 Kupon Sepeti</span>
                    <span onclick="clearSlip()" style="cursor:pointer; color:#e50914; font-size:11px;">İptal Et</span>
                </div>
                <div id="slip-detail" style="font-size:12px; background:#1a1c29; padding:8px; border-radius:6px; border:1px solid #2a2d42;"></div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="number" id="stake-input" placeholder="Yatırım Tutarı (TL)" value="100" style="flex:1; padding:7px; background:#1a1c29; border:1px solid #2a2d42; color:#fff; border-radius:6px; font-size:12px;" oninput="calcWin()" />
                    <button onclick="placeBet()" style="background:#2ecc71; color:#0b0c10; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">Kuponu Onayla</button>
                </div>
            </div>
        </div>

        <div class="modal" id="deposit-modal">
            <div class="modal-content">
                <div style="font-weight:bold; font-size:14px; display:flex; justify-content:between;">
                    <span>💳 Hızlı Para Yatırma</span>
                    <span onclick="closeDepositModal()" style="cursor:pointer; float:right;">&times;</span>
                </div>
                <div style="font-size:11px; color:#8a8bc0;">Papara / Havale ile bakiye yükleyin:</div>
                <input type="number" id="deposit-amount" value="500" style="padding:8px; background:#1a1c29; border:1px solid #2a2d42; color:#fff; border-radius:6px;" />
                <button onclick="makeDeposit()" style="background:#2ecc71; color:#0b0c10; border:none; padding:9px; border-radius:6px; font-weight:bold; cursor:pointer;">Bakiyeye Ekle</button>
            </div>
        </div>

        <button class="btn-support" onclick="toggleSupport()">💬 Canlı Destek</button>
        <div id="support-box">
            <div style="background: #e50914; padding: 10px 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <span>💬 BetZirve Canlı Destek</span>
                <span onclick="toggleSupport()" style="cursor:pointer; font-size:16px;">&times;</span>
            </div>
            <div id="chat-messages"></div>
            <div style="padding: 8px; display: flex; gap: 5px; background: #12131c; border-top: 1px solid #1f2130;">
                <input type="text" id="chat-input" placeholder="Mesajınızı yazın..." style="flex:1; padding: 7px 10px; border-radius: 6px; border: 1px solid #2a2d42; background: #1a1c29; color: #fff; font-size: 12px;" />
                <button onclick="sendMsg()" style="background: #e50914; color:white; border:none; padding: 7px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size: 12px;">Gönder</button>
            </div>
        </div>

        <script>
        let isRegisterMode = false;
        let activeSelection = null;

        function toggleAuthMode() {
            isRegisterMode = !isRegisterMode;
            document.getElementById("auth-title").innerText = isRegisterMode ? "Yeni Hesap Oluştur" : "Hesabınıza Giriş Yapın";
            document.getElementById("auth-submit-btn").innerText = isRegisterMode ? "Kayıt Ol" : "Giriş Yap";
            document.getElementById("auth-switch-text").innerText = isRegisterMode ? "Zaten hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol";
        }

        function handleAuth() {
            let username = document.getElementById("auth-username").value.trim();
            let password = document.getElementById("auth-password").value.trim();
            if(!username || !password) { alert("Lütfen tüm alanları doldurun!"); return; }

            let endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
            fetch(endpoint, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username, password})
            }).then(r => r.json()).then(res => {
                if(res.success) {
                    if(isRegisterMode) {
                        alert(res.message);
                        toggleAuthMode();
                    } else {
                        localStorage.setItem("betzirve_token", res.token);
                        checkAuth();
                    }
                } else {
                    alert(res.message);
                }
            });
        }

        function checkAuth() {
            let token = localStorage.getItem("betzirve_token");
            if(!token) { document.getElementById("auth-container").style.display = "flex"; return; }
            fetch("/api/user", { headers: {"Authorization": token} })
            .then(r => r.json()).then(res => {
                if(res.success) {
                    document.getElementById("auth-container").style.display = "none";
                    document.getElementById("logged-user").innerText = res.username;
                    document.getElementById("user-balance").innerText = parseFloat(res.balance).toFixed(2);
                    renderCoupons(res.coupons);
                    fetchOdds();
                    fetchSlots();
                } else {
                    localStorage.removeItem("betzirve_token");
                    document.getElementById("auth-container").style.display = "flex";
                }
            });
        }
        checkAuth();

        function logout() { localStorage.removeItem("betzirve_token"); location.reload(); }

        let selectedLeague = "Tümü";
        function filterLeague(league, btn) {
            selectedLeague = league;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            fetchOdds();
        }

        function fetchOdds() {
            let search = document.getElementById("search-input").value;
            fetch(\`/api/live/odds?league=\${encodeURIComponent(selectedLeague)}&search=\${encodeURIComponent(search)}\`)
            .then(r => r.json()).then(data => {
                let html = "";
                document.getElementById("match-count").innerText = data.length + " Maç";
                data.forEach(m => {
                    html += \`<div class="match-card">
                        <div class="match-header">
                            <span>\${m.league}</span>
                            <span>\${m.minute} <span class="match-score">\${m.score}</span></span>
                        </div>
                        <div class="match-body">
                            <div class="match-teams">\${m.match}</div>
                            <div class="odds-group">
                                <div class="odd-btn" onclick="selectOdd(\${m.id}, '\${m.match}', '1', \${m.odds.ms1}, this)">1<br><b>\${m.odds.ms1}</b></div>
                                <div class="odd-btn" onclick="selectOdd(\${m.id}, '\${m.match}', 'X', \${m.odds[0]}, this)">X<br><b>\${m.odds[0]}</b></div>
                                <div class="odd-btn" onclick="selectOdd(\${m.id}, '\${m.match}', '2', \${m.odds.ms2}, this)">2<br><b>\${m.odds.ms2}</b></div>
                            </div>
                        </div>
                    </div>\`;
                });
                document.getElementById("odds-list").innerHTML = html;
            });
        }

        function selectOdd(matchId, matchName, selection, odd, el) {
            document.querySelectorAll(".odd-btn").forEach(b => b.classList.remove("selected"));
            el.classList.add("selected");
            activeSelection = { matchId, matchName, selection, odd };
            document.getElementById("bet-slip").style.display = "block";
            updateSlipDetail();
        }

        function updateSlipDetail() {
            if(!activeSelection) return;
            let stake = parseFloat(document.getElementById("stake-input").value) || 0;
            let win = (stake * activeSelection.odd).toFixed(2);
            document.getElementById("slip-detail").innerHTML = \`
                <div><b>\${activeSelection.matchName}</b></div>
                <div style="color:#2ecc71;">Seçim: <b>\${activeSelection.selection}</b> | Oran: <b>\${activeSelection.odd}</b></div>
                <div>Olası Kazanç: <b style="color:#2ecc71;">\${win} TL</b></div>
            \`;
        }
        function calcWin() { updateSlipDetail(); }
        function clearSlip() {
            activeSelection = null;
            document.getElementById("bet-slip").style.display = "none";
            document.querySelectorAll(".odd-btn").forEach(b => b.classList.remove("selected"));
        }

        function placeBet() {
            if(!activeSelection) return;
            let stake = document.getElementById("stake-input").value;
            let token = localStorage.getItem("betzirve_token");

            fetch("/api/bet/play", {
                method: "POST",
                headers: {"Content-Type": "application/json", "Authorization": token},
                body: JSON.stringify({ matchId: activeSelection.matchId, selection: activeSelection.selection, odd: activeSelection.odd, stake })
            }).then(r => r.json()).then(res => {
                if(res.success) { alert("Kupon başarıyla oynandı!"); checkAuth(); clearSlip(); }
                else { alert(res.message); }
            });
        }

        function renderCoupons(coupons) {
            if(!coupons || coupons.length === 0) { document.getElementById("user-coupons").innerHTML = "Henüz kupon yapılmadı."; return; }
            let html = "";
            coupons.forEach(c => {
                html += \`<div style="border-bottom:1px solid #1f2130; padding-bottom:6px; margin-bottom:6px;">
                    <div><b>\${c.match}</b></div>
                    <div style="color:#8a8bc0;">Tahmin: \${c.selection} (Oran: \${c.odd}) | Yatırım: \${c.stake} TL</div>
                    <div style="display:flex; justify-content:space-between; color:#2ecc71;">
                        <span>Olası Kazanç: \${c.possibleWin} TL</span>
                        <span style="color:#f1c40f;">\${c.status}</span>
                    </div>
                </div>\`;
            });
            document.getElementById("user-coupons").innerHTML = html;
        }

        function openDepositModal() { document.getElementById("deposit-modal").style.display = "flex"; }
        function closeDepositModal() { document.getElementById("deposit-modal").style.display = "none"; }

        function makeDeposit() {
            let amount = document.getElementById("deposit-amount").value;
            let token = localStorage.getItem("betzirve_token");
            fetch("/api/wallet/deposit", {
                method: "POST",
                headers: {"Content-Type": "application/json", "Authorization": token},
                body: JSON.stringify({amount})
            }).then(r => r.json()).then(res => {
                if(res.success) { alert(amount + " TL yüklendi!"); checkAuth(); closeDepositModal(); }
            });
        }

        function fetchSlots() {
            fetch("/api/slots").then(r => r.json()).then(data => {
                let html = "";
                data.forEach(s => {
                    html += \`<div class="slot-item" onclick="alert('\\u26a1 ' + '\\\\'' + s.name + '\\\\'' + ' oyunu başlatılıyor...')">
                        <div style="font-size:24px; margin-bottom:3px;">\${s.image}</div>
                        <div style="font-size:12px; font-weight:bold;">\${s.name}</div>
                        <div style="font-size:10px; color:#8a8bc0;">\${s.rtp}</div>
                    </div>\`;
                });
                document.getElementById("slots-list").innerHTML = html;
            });
        }

        function toggleSupport() {
            let box = document.getElementById("support-box");
            box.style.display = box.style.display === "flex" ? "none" : "flex";
            if(box.style.display === "flex") fetchMsgs();
        }

        function fetchMsgs() {
            fetch("/api/support/messages").then(r => r.json()).then(msgs => {
                let html = "";
                msgs.forEach(m => {
                    let isUser = m.sender === "Siz";
                    let bg = isUser ? "background:#e50914; align-self:flex-end;" : "background:#1a1c29; align-self:flex-start; border:1px solid #2a2d42;";
                    html += \`<div style="\${bg} padding:7px 10px; border-radius:6px; max-width:85%; line-height:1.3;">
                        <div style="font-size:10px; opacity:0.7; margin-bottom:2px;">\${m.sender} - \${m.time}</div>
                        <div>\${m.text}</div>
                    </div>\`;
                });
                let cm = document.getElementById("chat-messages");
                cm.innerHTML = html; cm.scrollTop = cm.scrollHeight;
            });
        }

        function sendMsg() {
            let inp = document.getElementById("chat-input");
            let text = inp.value.trim();
            if(!text) return;
            fetch("/api/support/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({message: text})
            }).then(() => { inp.value = ""; fetchMsgs(); setTimeout(fetchMsgs, 1200); });
        }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("Kalıcı Veritabanlı BetZirve aktif: http://0.0.0.0:" + PORT);
});

// Giriş ve Kayıt API Rotaları
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
    }
    const db = loadDB();
    if (!db.users) db.users = [];
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Bu kullanıcı adı zaten alınmış.' });
    }
    db.users.push({ username, password, balance: 1000 });
    saveDB(db);
    res.json({ success: true, message: 'Kayıt başarılı!' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = loadDB();
    const user = (db.users || []).find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: 'Hatalı kullanıcı adı veya şifre.' });
    }
    res.json({ success: true, message: 'Giriş başarılı!', user: { username: user.username } });
});
