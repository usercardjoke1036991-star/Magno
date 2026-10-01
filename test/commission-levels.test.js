const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('level commission list', function () {
  it('exposes one row per generation instead of 6–12 / 13–40 bands', function () {
    const commissions = fs.readFileSync(path.join(__dirname, '..', 'constants', 'commissions.ts'), 'utf8');
    expect(commissions).to.include('commissionRowsForLoan');
    expect(commissions).to.include('commissionLine()');
    expect(commissions).to.include('MAX_COMMISSION_LINE = 40');
    expect(commissions).to.match(/range: String\(gen\)/);
    expect(commissions).to.include('directCommissionRowsForTiers');
    expect(commissions).to.include('COMMISSION_BANDS');
  });

  it('keeps the 40 rows behind an accordion on each loan tier', function () {
    const card = fs.readFileSync(path.join(__dirname, '..', 'components', 'LoanTierCard.tsx'), 'utf8');
    expect(card).to.include('commissionRowsForLoan');
    expect(card).to.include('commsOpen');
    expect(card).to.include('setCommsOpen');
    expect(card).to.include('referralEarnBand');
    expect(card).to.not.include('commissionBandsForLoan');
    expect(card).to.not.match(/Bronce|Oro|Platino/);
    const catalog = fs.readFileSync(path.join(__dirname, '..', 'components', 'LockedLoanCatalog.tsx'), 'utf8');
    expect(catalog).to.include('LoanTierCard');
  });

  it('summarizes Red generations as COMMISSION_BANDS', function () {
    const referrals = fs.readFileSync(path.join(__dirname, '..', 'components', 'ReferralSection.tsx'), 'utf8');
    expect(referrals).to.include('COMMISSION_BANDS');
    expect(referrals).to.not.match(/commissionLine\(\)/);
    expect(referrals).to.include('directCommissionRowsForTiers');
    expect(referrals).to.include('levelCommsOpen');
    expect(referrals).to.include('MAX_LOAN_LEVEL');
    expect(referrals).to.include('FlatList');
    expect(referrals).to.include("useState(false)");
  });
});
