const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Render notify worker', function () {
  const root = path.join(__dirname, '..');

  it('pins Docker, health, disk and does not ship owner keys', function () {
    const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
    const docker = fs.readFileSync(path.join(root, 'Dockerfile.notify'), 'utf8');
    const worker = fs.readFileSync(path.join(root, 'scripts', 'notify-worker.mjs'), 'utf8');
    const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
    expect(yaml).to.include('dockerfilePath: ./Dockerfile.notify');
    expect(yaml).to.include('healthCheckPath: /health');
    expect(yaml).to.include('mountPath: /data');
    expect(yaml).to.include('plan: starter');
    expect(yaml).to.include('generateValue: true');
    expect(yaml).to.include('autoDeployTrigger: commit');
    expect(yaml).to.match(/TWILIO_ACCOUNT_SID[\s\S]*sync: false/);
    expect(yaml).to.not.match(/PRIVATE_KEY/);
    expect(yaml).to.not.include('ATTESTER_PRIVATE_KEY');
    expect(docker).to.include('NOTIFY_BIND=0.0.0.0');
    expect(docker).to.include('NOTIFY_TRUST_PROXY=1');
    expect(docker).to.include('NOTIFY_DATA_FILE=/data/.notify-data.json');
    expect(docker).to.include('mkdir -p /data');
    expect(dockerignore).to.include('!scripts/');
    expect(worker).to.include("path === '/health'");
    expect(worker).to.include('mkdirSync(dirname(DATA_FILE)');
    expect(worker).to.include('const isHealth');
    expect(worker).to.include('process.env.PORT || process.env.NOTIFY_PORT || 8787');
  });

  it('listens on PORT, creates data dir and answers /health', async function () {
    this.timeout(20000);
    const { spawn } = require('child_process');
    const http = require('http');
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-render-'));
    const dataFile = path.join(dir, 'nested', '.notify-data.json');
    const port = 18787 + Math.floor(Math.random() * 1000);
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'notify-worker.mjs')], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        NOTIFY_BIND: '127.0.0.1',
        NOTIFY_DATA_KEY: 'render-audit-key-32chars!!',
        NOTIFY_DATA_FILE: dataFile,
        EXPO_PUBLIC_CHAIN_ID: '97',
        EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET: '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f',
        NOTIFY_CORS_ORIGIN: '*',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const waitStart = () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('worker start timeout')), 12000);
        const onExit = (code) => {
          clearTimeout(timer);
          reject(new Error(`worker exited ${code}`));
        };
        const onData = (buf) => {
          if (String(buf).includes('Avisos Quatrivium')) {
            clearTimeout(timer);
            child.removeListener('exit', onExit);
            resolve();
          }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.once('exit', onExit);
      });
    try {
      await waitStart();
      const body = await new Promise((resolve, reject) => {
        http
          .get({ hostname: '127.0.0.1', port, path: '/health' }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => resolve({ status: res.statusCode, data }));
          })
          .on('error', reject);
      });
      expect(body.status).to.equal(200);
      const parsed = JSON.parse(body.data);
      expect(parsed.ok).to.equal(true);
      expect(parsed.chainId).to.equal(97);
    } finally {
      child.kill('SIGTERM');
    }
  });
});
