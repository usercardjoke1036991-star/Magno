const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('alerts use Telegram only', function () {
  it('hides email, phone and WhatsApp from the alerts panel', function () {
    const ui = fs.readFileSync(path.join(__dirname, '..', 'components', 'NotificationChannels.tsx'), 'utf8');
    expect(ui).to.include('notificationOpenTelegram');
    expect(ui).to.not.include('notificationEmail');
    expect(ui).to.not.include('notificationWhatsApp');
    expect(ui).to.not.include('notificationPhone');
    expect(ui).to.not.include('notificationInvalidPhone');
    expect(ui).to.include("email: false");
  });

  it('sends debt and commission alerts only to Telegram', function () {
    const worker = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'notify-worker.mjs'), 'utf8');
    const notify = worker.slice(worker.indexOf('const notifyWallet'), worker.indexOf('const bindTelegram'));
    expect(notify).to.include('sendTelegram');
    expect(notify).to.not.include('sendWhatsApp');
    expect(notify).to.not.include('sendEmail');
    expect(worker).to.include('const deliverOtp');
    expect(worker).to.include('sendTextbelt');
  });

  it('keeps identity email and phone screens', function () {
    const security = fs.readFileSync(path.join(__dirname, '..', 'components', 'SecuritySettings.tsx'), 'utf8');
    expect(security).to.include('accountEmail');
    expect(fs.existsSync(path.join(__dirname, '..', 'services', 'accountEmail.ts'))).to.equal(true);
    expect(fs.existsSync(path.join(__dirname, '..', 'services', 'accountPhone.ts'))).to.equal(true);
  });

  it('resolves the public Telegram bot from env or the notify worker', function () {
    const ui = fs.readFileSync(path.join(__dirname, '..', 'components', 'NotificationChannels.tsx'), 'utf8');
    const bot = fs.readFileSync(path.join(__dirname, '..', 'services', 'telegramBot.ts'), 'utf8');
    const worker = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'notify-worker.mjs'), 'utf8');
    expect(ui).to.include('resolveTelegramBot');
    expect(ui).to.include('notifyJsonBody');
    expect(ui).to.not.include('TELEGRAM_BOT_TOKEN');
    expect(bot).to.include("'/telegram/bot'");
    expect(bot).to.not.include('TELEGRAM_BOT_TOKEN');
    expect(worker).to.include("path === '/telegram/bot'");
    expect(worker).to.include('/getMe');
    expect(worker).to.include('EXPO_PUBLIC_TELEGRAM_BOT');
    expect(worker).to.include('json(res, 200, { bot })');
    expect(worker).to.include('sanitizeTelegramBot');
    expect(worker).to.include('telegramBotName.cjs');
    expect(worker).to.not.match(/json\(res, 200, \{[^}]*TELEGRAM_TOKEN/);
  });

  it('shares an app invite link, not Play Store', function () {
    const invite = fs.readFileSync(path.join(__dirname, '..', 'utils', 'inviteCode.ts'), 'utf8');
    expect(invite).to.include('INVITE_APP_SCHEME');
    expect(invite).to.include('://invite?c=');
    expect(invite).to.not.include('PLAY_STORE_URL');
  });
});
