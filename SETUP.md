# 🎲 Ludo Elite — Complete Setup Guide

## Files:
- `index.html`  → Telegram Mini App (game UI)
- `server.js`   → WebSocket server (game logic)
- `bot.py`      → Telegram Bot
- `package.json`→ Node.js dependencies

---

## STEP 1: Deploy WebSocket Server (Render.com — FREE)

1. GitHub pe new repo banao: `ludo-elite-server`
2. `server.js` aur `package.json` push karo
3. Render.com pe jao → New → Web Service
4. GitHub repo connect karo
5. Settings:
   - **Name:** ludo-elite-server
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
6. Deploy karo
7. Render tumhe dega: `https://ludo-elite-server.onrender.com`
   → Ye tera **SERVER_URL** hai

---

## STEP 2: Deploy Mini App (Vercel / GitHub Pages — FREE)

### Option A: GitHub Pages (Easiest)
1. New GitHub repo banao: `ludo-elite`
2. `index.html` push karo
3. Settings → Pages → Source: main branch
4. URL milega: `https://username.github.io/ludo-elite`

### Option B: Vercel
1. vercel.com → New Project
2. `index.html` upload karo
3. URL milega: `https://ludo-elite.vercel.app`

---

## STEP 3: Update URLs in Code

### index.html mein line ~210:
```javascript
const SERVER_URL = 'wss://ludo-elite-server.onrender.com';
//                       ↑ apna Render URL daalo (https → wss)
```

### bot.py mein:
```python
BOT_TOKEN  = "1234567890:ABCdef..."   # @BotFather se
WEBAPP_URL = "https://username.github.io/ludo-elite"  # apna Mini App URL
```

---

## STEP 4: Telegram Bot Setup

1. **@BotFather** ko message karo Telegram pe
2. `/newbot` → name → username
3. **Bot Token** copy karo
4. `/setmenubutton` → apna bot select karo → URL daalo (Mini App URL)
5. `/setinline` → enable karo

---

## STEP 5: Run Bot

```bash
pip install python-telegram-bot==20.7
python bot.py
```

### Environment variables use karna chahte ho:
```bash
export BOT_TOKEN="your_token"
export WEBAPP_URL="https://your-app.vercel.app"
python bot.py
```

---

## STEP 6: Test Karo

1. Telegram pe apna bot dhundho
2. `/start` bhejo
3. **Play Ludo** tap karo
4. Create Room → code copy karo
5. Dost ko code bhejo → Join Room

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Server unreachable" | Render URL check karo, wss:// use karo |
| Bot not responding | BOT_TOKEN sahi hai? Bot running hai? |
| Mini App nahi khul raha | HTTPS URL chahiye, HTTP nahi |
| Render server slow | Free tier me 50s cold start hoti hai, wait karo |

---

## Quick Test (Local)
```bash
# Server start karo
npm install
node server.js

# index.html mein SERVER_URL badlo:
# const SERVER_URL = 'ws://localhost:3000';

# Browser mein kholo: index.html
```

---

**Stack:** Pure HTML/CSS/JS + Node.js ws + Python python-telegram-bot
**Cost:** FREE (Render free tier + GitHub Pages + Vercel free)
