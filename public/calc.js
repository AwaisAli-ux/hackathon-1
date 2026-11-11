// Wirasat Saathi — deterministic inheritance share calculator.
// Plain code, no AI. Sunni Hanafi rules, close heirs only:
// spouse, father, mother, sons, daughters, full brothers, full sisters.

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const fr = (n, d = 1) => {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const add = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => fr(a.n * b.n, a.d * b.d);
const div = (a, b) => fr(a.n * b.d, a.d * b.n);
const gt = (a, b) => a.n * b.d > b.n * a.d;
const ZERO = fr(0);
const ONE = fr(1);

export const fstr = (f) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
export const fnum = (f) => f.n / f.d;

const ORDER = ['husband', 'wives', 'sons', 'daughters', 'father', 'mother', 'brothers', 'sisters'];

export function calculate(raw = {}) {
  const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const deceasedGender = raw.deceasedGender === 'female' ? 'female' : 'male';
  const husband = deceasedGender === 'female' && !!raw.husband;
  const wives = deceasedGender === 'male' ? Math.min(4, int(raw.wives)) : 0;
  const sons = int(raw.sons);
  const daughters = int(raw.daughters);
  const brothers = int(raw.brothers);
  const sisters = int(raw.sisters);
  const father = !!raw.father;
  const mother = !!raw.mother;
  const estate = Number(raw.estate) > 0 ? Number(raw.estate) : null;

  const hasSon = sons > 0;
  const hasChild = sons + daughters > 0;
  const sibs = brothers + sisters;
  const hasSpouse = husband || wives > 0;

  const E = {};
  const put = (key, label, count, share, reason, extra = {}) => {
    E[key] = { key, label, count, share, reasons: [reason], ...extra };
  };
  let resid = null; // [{ key, weight }] — who takes the remainder

  // Spouse
  let spouseShare = ZERO;
  if (husband) {
    spouseShare = hasChild ? fr(1, 4) : fr(1, 2);
    put('husband', 'شوہر', 1, spouseShare,
      hasChild ? 'اولاد موجود ہے، اس لیے شوہر کا حصہ 1/4 ہے۔' : 'اولاد نہیں ہے، اس لیے شوہر کا حصہ 1/2 ہے۔',
      { isSpouse: true });
  }
  if (wives > 0) {
    spouseShare = hasChild ? fr(1, 8) : fr(1, 4);
    put('wives', wives > 1 ? 'بیویاں' : 'بیوی', wives, spouseShare,
      (hasChild ? 'اولاد موجود ہے، اس لیے بیوی کا حصہ 1/8 ہے۔' : 'اولاد نہیں ہے، اس لیے بیوی کا حصہ 1/4 ہے۔') +
        (wives > 1 ? ' یہ حصہ سب بیویوں میں برابر تقسیم ہوتا ہے۔' : ''),
      { isSpouse: true });
  }

  // Mother
  if (mother) {
    if (hasChild || sibs >= 2) {
      put('mother', 'والدہ', 1, fr(1, 6),
        hasChild ? 'اولاد موجود ہے، اس لیے والدہ کا حصہ 1/6 ہے۔' : 'دو یا زیادہ بہن بھائی موجود ہیں، اس لیے والدہ کا حصہ 1/6 ہے۔');
    } else if (father && hasSpouse) {
      put('mother', 'والدہ', 1, mul(fr(1, 3), sub(ONE, spouseShare)),
        'شوہر/بیوی اور والد دونوں موجود ہیں، اس لیے والدہ کو شوہر/بیوی کا حصہ نکالنے کے بعد باقی کا 1/3 ملتا ہے۔');
    } else {
      put('mother', 'والدہ', 1, fr(1, 3), 'اولاد نہیں اور بہن بھائی دو سے کم ہیں، اس لیے والدہ کا حصہ 1/3 ہے۔');
    }
  }

  // Children
  if (hasSon) {
    put('sons', sons > 1 ? 'بیٹے' : 'بیٹا', sons, ZERO, 'مقررہ حصے دینے کے بعد جو بچتا ہے وہ اولاد کو ملتا ہے۔');
    resid = [{ key: 'sons', weight: 2 * sons }];
    if (daughters > 0) {
      put('daughters', daughters > 1 ? 'بیٹیاں' : 'بیٹی', daughters, ZERO,
        'بیٹے کے ساتھ بیٹی باقی ترکے میں شریک ہوتی ہے: ہر بیٹی کو بیٹے کے حصے کا آدھا ملتا ہے۔');
      resid.push({ key: 'daughters', weight: daughters });
    }
  } else if (daughters === 1) {
    put('daughters', 'بیٹی', 1, fr(1, 2), 'بیٹا نہیں ہے اور ایک ہی بیٹی ہے، اس لیے اس کا حصہ 1/2 ہے۔');
  } else if (daughters > 1) {
    put('daughters', 'بیٹیاں', daughters, fr(2, 3), 'بیٹا نہیں ہے اور دو یا زیادہ بیٹیاں ہیں، اس لیے سب بیٹیوں کا مشترکہ حصہ 2/3 ہے۔');
  }

  // Father
  if (father) {
    if (hasSon) {
      put('father', 'والد', 1, fr(1, 6), 'بیٹا موجود ہے، اس لیے والد کا حصہ 1/6 ہے۔');
    } else if (daughters > 0) {
      put('father', 'والد', 1, fr(1, 6), 'صرف بیٹیاں ہیں، اس لیے والد کو 1/6 اور مقررہ حصوں کے بعد جو بچے وہ بھی ملتا ہے۔');
      resid = [{ key: 'father', weight: 1 }];
    } else {
      put('father', 'والد', 1, ZERO, 'اولاد نہیں ہے، اس لیے والد کو مقررہ حصوں کے بعد باقی سب ملتا ہے۔');
      resid = [{ key: 'father', weight: 1 }];
    }
  }

  // Full siblings
  if (sibs > 0) {
    const bLabel = brothers > 1 ? 'سگے بھائی' : 'سگا بھائی';
    const sLabel = sisters > 1 ? 'سگی بہنیں' : 'سگی بہن';
    if (hasSon || father) {
      const why = hasSon ? 'بیٹے کی موجودگی میں بہن بھائیوں کو حصہ نہیں ملتا۔' : 'والد کی موجودگی میں بہن بھائیوں کو حصہ نہیں ملتا۔';
      if (brothers > 0) put('brothers', bLabel, brothers, ZERO, why, { blocked: true });
      if (sisters > 0) put('sisters', sLabel, sisters, ZERO, why, { blocked: true });
    } else if (brothers > 0) {
      put('brothers', bLabel, brothers, ZERO, 'بیٹا اور والد نہیں ہیں، اس لیے مقررہ حصوں کے بعد جو بچے وہ بہن بھائیوں کو ملتا ہے۔');
      resid = [{ key: 'brothers', weight: 2 * brothers }];
      if (sisters > 0) {
        put('sisters', sLabel, sisters, ZERO, 'بھائی کے ساتھ بہن کو بھائی کے حصے کا آدھا ملتا ہے۔');
        resid.push({ key: 'sisters', weight: sisters });
      }
    } else if (daughters > 0) {
      put('sisters', sLabel, sisters, ZERO, 'بیٹیوں کے ساتھ بہنیں مقررہ حصوں کے بعد بچا ہوا حصہ لیتی ہیں۔');
      resid = [{ key: 'sisters', weight: 1 }];
    } else if (sisters === 1) {
      put('sisters', sLabel, 1, fr(1, 2), 'اولاد، والد اور بھائی نہیں ہیں اور ایک ہی بہن ہے، اس لیے اس کا حصہ 1/2 ہے۔');
    } else {
      put('sisters', sLabel, sisters, fr(2, 3), 'اولاد، والد اور بھائی نہیں ہیں اور دو یا زیادہ بہنیں ہیں، اس لیے ان کا مشترکہ حصہ 2/3 ہے۔');
    }
  }

  const list = Object.values(E);
  if (list.length === 0) {
    return { ok: false, error: 'کم از کم ایک وارث درج کریں۔' };
  }

  const flags = { awl: false, radd: false };
  let unallocated = ZERO;
  const sum = list.reduce((s, e) => add(s, e.share), ZERO);

  if (gt(sum, ONE)) {
    // Awl: fixed shares exceed the estate, so all are reduced in proportion.
    flags.awl = true;
    for (const e of list) {
      if (gt(e.share, ZERO)) {
        e.share = div(e.share, sum);
        e.reasons.push('مقررہ حصوں کا مجموعہ ترکے سے زیادہ تھا، اس لیے سب کے حصے اسی تناسب سے کم کیے گئے (عول)۔');
      }
    }
  } else {
    const residue = sub(ONE, sum);
    if (gt(residue, ZERO)) {
      if (resid) {
        const totalW = resid.reduce((s, r) => s + r.weight, 0);
        for (const r of resid) E[r.key].share = add(E[r.key].share, mul(residue, fr(r.weight, totalW)));
      } else {
        // Radd: remainder returns to the fixed sharers other than the spouse.
        const eligible = list.filter((e) => !e.isSpouse && !e.blocked && gt(e.share, ZERO));
        if (eligible.length) {
          flags.radd = true;
          const base = eligible.reduce((s, e) => add(s, e.share), ZERO);
          for (const e of eligible) {
            e.share = add(e.share, mul(residue, div(e.share, base)));
            e.reasons.push('باقی بچا ہوا حصہ لینے والا کوئی اور وارث نہیں، اس لیے وہ انہی ورثا کو ان کے حصوں کے تناسب سے واپس ملا (رد)۔');
          }
        } else {
          unallocated = residue;
        }
      }
    }
  }
  if (resid) {
    for (const r of resid) {
      const e = E[r.key];
      if (!gt(e.share, ZERO)) e.reasons.push('اس صورت میں مقررہ حصوں کے بعد کچھ نہیں بچا۔');
    }
  }

  const rows = ORDER.filter((k) => E[k]).map((k) => {
    const e = E[k];
    const each = div(e.share, fr(e.count));
    return {
      key: e.key,
      label: e.label,
      count: e.count,
      total: e.share,
      each,
      percentEach: Math.round(fnum(each) * 10000) / 100,
      amountEach: estate ? Math.round(estate * fnum(each)) : null,
      reason: e.reasons.join(' '),
      blocked: !!e.blocked,
    };
  });

  return {
    ok: true,
    input: { deceasedGender, husband, wives, sons, daughters, father, mother, brothers, sisters, estate },
    rows,
    flags,
    unallocated,
    estate,
  };
}
