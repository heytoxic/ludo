"""
LUDO ELITE — Telegram Bot
Python 3.10+
Install: pip install python-telegram-bot==20.7
Run: python bot.py
"""

import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

# ── CONFIG ──────────────────────────────────────
BOT_TOKEN  = os.getenv("BOT_TOKEN", "8507021627:AAGv_DE_0JVwakzjW_J7g-hArW3grpEc3fc")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://YOUR_WEBAPP_URL_HERE")
# e.g. https://ludo-elite.vercel.app  or  https://youruser.github.io/ludo
# ────────────────────────────────────────────────

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════
#  /start
# ══════════════════════════════════════
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    name = user.first_name or "Player"

    keyboard = [
        [InlineKeyboardButton(
            "🎲 Play Ludo",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [
            InlineKeyboardButton("🔗 Share Game", switch_inline_query="ludo"),
            InlineKeyboardButton("ℹ️ How to Play", callback_data="howtoplay")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"🎲 *Welcome to Ludo Elite, {name}!*\n\n"
        "Play Ludo with your friends in real-time!\n\n"
        "• Create a room and share the code\n"
        "• Up to 4 players online\n"
        "• Spectate your friends' games\n"
        "• Beautiful mobile UI\n\n"
        "_Tap Play Ludo to get started!_",
        parse_mode="Markdown",
        reply_markup=reply_markup
    )


# ══════════════════════════════════════
#  /play — quick open button
# ══════════════════════════════════════
async def play(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton(
        "🎲 Open Ludo Elite",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )]]
    await update.message.reply_text(
        "🎮 *Ludo Elite*\nTap below to open the game!",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


# ══════════════════════════════════════
#  /ludo — send game invite to group
# ══════════════════════════════════════
async def ludo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton(
        "🎲 Join Ludo Elite",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )]]
    await update.message.reply_text(
        "🎲 *Ludo Elite — Multiplayer*\n\n"
        "Join the room and play together!\n"
        "Create a room, share the code, and let's play!",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


# ══════════════════════════════════════
#  Inline query (share game link)
# ══════════════════════════════════════
async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from telegram import InlineQueryResultArticle, InputTextMessageContent
    import uuid
    results = [
        InlineQueryResultArticle(
            id=str(uuid.uuid4()),
            title="🎲 Invite to Ludo Elite",
            description="Send a Ludo game invite to your group!",
            input_message_content=InputTextMessageContent(
                f"🎲 *Let's play Ludo!*\n\n"
                f"Join me for a game of Ludo Elite — multiplayer, real-time!\n"
                f"[Play Now]({WEBAPP_URL})",
                parse_mode="Markdown"
            ),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🎮 Play Ludo", web_app=WebAppInfo(url=WEBAPP_URL))
            ]])
        )
    ]
    await update.inline_query.answer(results)


# ══════════════════════════════════════
#  Callback: How to play
# ══════════════════════════════════════
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "howtoplay":
        await query.message.reply_text(
            "📖 *How to Play Ludo Elite*\n\n"
            "1️⃣ Tap *Play Ludo* to open the game\n"
            "2️⃣ Choose *Create Room* to host a game\n"
            "3️⃣ Select number of players (2-4)\n"
            "4️⃣ Share the *Room Code* with friends\n"
            "5️⃣ Friends tap *Join Room* and enter the code\n"
            "6️⃣ Host taps *Start Game* when everyone is ready\n\n"
            "👁 *Spectate*: Enter a room code without joining to watch!\n\n"
            "*Game Rules:*\n"
            "• Roll 6 to enter the board\n"
            "• Reach home to finish all 4 pieces\n"
            "• Land on opponent → send them home!\n"
            "• ★ Safe cells protect your pieces\n"
            "• Roll 6 = extra turn!",
            parse_mode="Markdown"
        )


# ══════════════════════════════════════
#  WebApp data (if user sends data back)
# ══════════════════════════════════════
async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = update.message.web_app_data.data
    user = update.effective_user
    logger.info(f"WebApp data from {user.first_name}: {data}")
    # You can handle game results here if needed
    await update.message.reply_text(f"🎲 Game data received!")


# ══════════════════════════════════════
#  Main
# ══════════════════════════════════════
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("play",  play))
    app.add_handler(CommandHandler("ludo",  ludo))
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data))

    from telegram.ext import InlineQueryHandler
    app.add_handler(InlineQueryHandler(inline_query))

    logger.info("🎲 Ludo Elite Bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
