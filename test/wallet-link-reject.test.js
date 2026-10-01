const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('wallet link reject stays idle', function () {
  it('swallows AppKit cancel instead of painting a red error', function () {
    const helper = fs.readFileSync(path.join(__dirname, '..', 'utils', 'openWalletConnect.ts'), 'utf8');
    expect(helper).to.include('openWalletConnect');
    expect(helper).to.include('catch');
    const card = fs.readFileSync(path.join(__dirname, '..', 'components', 'LinkedWalletCard.tsx'), 'utf8');
    expect(card).to.include('openWalletConnect');
    expect(card).to.not.match(/^\s+open\(\);\s*$/m);
    const form = fs.readFileSync(path.join(__dirname, '..', 'components', 'LinkWalletForm.tsx'), 'utf8');
    expect(form).to.include('openWalletConnect');
    expect(form).to.include("setError('')");
    expect(form).to.not.include("onPress={() => open()}");
    const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(app).to.include('User rejected methods');
    expect(app).to.include('Reject Session');
  });
});
