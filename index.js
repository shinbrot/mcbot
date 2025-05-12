const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot has arrived');
});

app.listen(8000, () => {
  console.log('Server started');
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.settings.colorsEnabled = false;

  let pendingPromise = Promise.resolve();

  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password}`);
      console.log(`[Auth] Sent /register ${password}`);

      const onMessage = (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(`[MSG] ${msg}`);

        if (
          msg.includes('already registered') ||
          msg.includes('successfully registered') ||
          msg.includes('You are already registered')
        ) {
          bot.off('message', onMessage);
          resolve();
        } else if (
          msg.includes('already logged in') ||
          msg.includes('already authenticated')
        ) {
          bot.off('message', onMessage);
          resolve();
        } else if (msg.toLowerCase().includes('invalid')) {
          bot.off('message', onMessage);
          reject(`[Register] Failed: ${msg}`);
        }
      };

      bot.on('message', onMessage);
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      console.log(`[Auth] Sent /login ${password}`);

      const onMessage = (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(`[MSG] ${msg}`);

        if (
          msg.includes('successfully logged in') ||
          msg.includes('You are already logged in')
        ) {
          bot.off('message', onMessage);
          resolve();
        } else if (msg.toLowerCase().includes('invalid')) {
          bot.off('message', onMessage);
          reject(`[Login] Failed: ${msg}`);
        }
      };

      bot.on('message', onMessage);
    });
  }

  bot.once('spawn', () => {
    console.log('\x1b[33m[AfkBot] Bot joined the server', '\x1b[0m');

    if (config.utils['auto-auth'].enabled) {
      console.log('[INFO] Started auto-auth module');

      const password = config.utils['auto-auth'].password;
      setTimeout(() => {
        pendingPromise = pendingPromise
          .then(() => sendRegister(password))
          .then(() => sendLogin(password))
          .catch(error => console.error('[ERROR]', error));
      }, 4000);
    }

    if (config.utils['chat-messages'].enabled) {
      console.log('[INFO] Started chat-messages module');
      const messages = config.utils['chat-messages']['messages'];

      if (config.utils['chat-messages'].repeat) {
        const delay = config.utils['chat-messages']['repeat-delay'];
        let i = 0;

        setInterval(() => {
          bot.chat(`${messages[i]}`);
          i = (i + 1) % messages.length;
        }, delay * 1000);
      } else {
        messages.forEach((msg) => {
          bot.chat(msg);
        });
      }
    }

    const pos = config.position;

    if (config.position.enabled) {
      console.log(`\x1b[32m[Afk Bot] Moving to (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
    }

    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }
    }
  });

  bot.on('goal_reached', () => {
    console.log(`\x1b[32m[AfkBot] Bot arrived at the target location. ${bot.entity.position}\x1b[0m`);
  });

  bot.on('death', () => {
    console.log(`\x1b[33m[AfkBot] Bot has died and respawned at ${bot.entity.position}\x1b[0m`);
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => {
        createBot();
      }, config.utils['auto-recconect-delay']);
    });
  }

  bot.on('kicked', (reason) =>
    console.log('\x1b[33m', `[AfkBot] Bot was kicked. Reason: \n${reason}`, '\x1b[0m')
  );

  bot.on('error', (err) =>
    console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m')
  );
}

createBot();
