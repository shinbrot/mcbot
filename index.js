const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const express = require('express');
const axios = require('axios');
const config = require('./settings.json');

const app = express();
app.get('/', (req, res) => res.send('Bot aktif.'));
app.listen(8000, () => console.log('[Server] Web aktif di port 8000'));

// Fungsi kirim pesan ke Discord Webhook
function sendToDiscord(msg) {
  const webhookURL = config.utils.webhook_url;
  if (!webhookURL) return;
  axios.post(webhookURL, {
    content: `[BOT] ${msg}`
  }).catch(err => {
    console.log('[Webhook ERROR]', err.message);
  });
}

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'] || undefined,
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const mcData = mcDataLoader(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    console.log('[BOT] Bot berhasil masuk ke server');
    sendToDiscord('Bot berhasil masuk ke server');

    // Auto Register/Login
    if (config.utils['auto-auth'].enabled) {
      const pass = config.utils['auto-auth'].password;
      setTimeout(() => {
        bot.chat(`/register ${pass}`);
        bot.chat(`/login ${pass}`);
        console.log('[Auth] Mengirim /register dan /login');
        sendToDiscord('Mengirim /register dan /login');
      }, 3000);
    }

    // Chat auto
    if (config.utils['chat-messages'].enabled) {
      const msgs = config.utils['chat-messages'].messages;
      const delay = config.utils['chat-messages']['repeat-delay'] * 1000;
      if (config.utils['chat-messages'].repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(msgs[i]);
          i = (i + 1) % msgs.length;
        }, delay);
      } else {
        msgs.forEach(msg => bot.chat(msg));
      }
    }

    // Anti-AFK movement
    if (config.utils['anti-afk'].enabled) {
      console.log('[Anti-AFK] Aktif');
      sendToDiscord('Anti-AFK aktif');

      const radius = 8;
      setInterval(() => {
        const pos = bot.entity.position;
        const x = pos.x + Math.floor(Math.random() * radius * 2 - radius);
        const z = pos.z + Math.floor(Math.random() * radius * 2 - radius);
        const y = pos.y;
        bot.pathfinder.setGoal(new GoalBlock(x, y, z));
        console.log(`[Anti-AFK] Bergerak ke (${x.toFixed(1)}, ${y}, ${z.toFixed(1)})`);
      }, 15000 + Math.random() * 5000);

      setInterval(() => {
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI / 2;
        bot.look(yaw, pitch, true);
      }, 7000 + Math.random() * 2000);

      setInterval(() => {
        bot.swingArm('right');
      }, 25000 + Math.random() * 10000);
    }

    if (config.position.enabled) {
      const pos = config.position;
      console.log(`[BOT] Bergerak ke posisi awal: (${pos.x}, ${pos.y}, ${pos.z})`);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
    }
  });

  // Chat log listener
  if (config.utils['chat-log']) {
    bot.on('chat', (username, message) => {
      if (username !== bot.username) {
        const log = `[Chat] ${username}: ${message}`;
        console.log(log);
        sendToDiscord(log);
      }
    });
  }

  // Auto reconnect
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[Reconnect] Bot terputus, mencoba masuk kembali...');
      sendToDiscord('Bot disconnect. Mencoba reconnect...');
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }

  bot.on('error', err => {
    console.log('[ERROR]', err.message);
    sendToDiscord(`Error: ${err.message}`);
  });

  bot.on('kicked', reason => {
    console.log('[KICKED]', reason);
    sendToDiscord(`Kicked: ${reason}`);
  });
}

createBot();
