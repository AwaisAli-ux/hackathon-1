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

// Labels and reasons in both languages. The rules themselves are language independent.
const TEXT = {
  ur: {
    husband: 'شوہر', wife: 'بیوی', wives: 'بیویاں', mother: 'والدہ', father: 'والد',
    son: 'بیٹا', sons: 'بیٹے', daughter: 'بیٹی', daughters: 'بیٹیاں',
    brother: 'سگا بھائی', brothers: 'سگے بھائی', sister: 'سگی بہن', sisters: 'سگی بہنیں',
    hChild: 'اولاد موجود ہے، اس لیے شوہر کا حصہ 1/4 ہے۔',
    hNoChild: 'اولاد نہیں ہے، اس لیے شوہر کا حصہ 1/2 ہے۔',
    wChild: 'اولاد موجود ہے، اس لیے بیوی کا حصہ 1/8 ہے۔',
    wNoChild: 'اولاد نہیں ہے، اس لیے بیوی کا حصہ 1/4 ہے۔',
    wEqual: ' یہ حصہ سب بیویوں میں برابر تقسیم ہوتا ہے۔',
    mChild: 'اولاد موجود ہے، اس لیے والدہ کا حصہ 1/6 ہے۔',
    mSibs: 'دو یا زیادہ بہن بھائی موجود ہیں، اس لیے والدہ کا حصہ 1/6 ہے۔',
    mUmar: 'شوہر/بیوی اور والد دونوں موجود ہیں، اس لیے والدہ کو شوہر/بیوی کا حصہ نکالنے کے بعد باقی کا 1/3 ملتا ہے۔',
    mThird: 'اولاد نہیں اور بہن بھائی دو سے کم ہیں، اس لیے والدہ کا حصہ 1/3 ہے۔',
    cResid: 'مقررہ حصے دینے کے بعد جو بچتا ہے وہ اولاد کو ملتا ہے۔',
    dWithSon: 'بیٹے کے ساتھ بیٹی باقی ترکے میں شریک ہوتی ہے: ہر بیٹی کو بیٹے کے حصے کا آدھا ملتا ہے۔',
    dOne: 'بیٹا نہیں ہے اور ایک ہی بیٹی ہے، اس لیے اس کا حصہ 1/2 ہے۔',
    dMany: 'بیٹا نہیں ہے اور دو یا زیادہ بیٹیاں ہیں، اس لیے سب بیٹیوں کا مشترکہ حصہ 2/3 ہے۔',
    fSon: 'بیٹا موجود ہے، اس لیے والد کا حصہ 1/6 ہے۔',
    fDaughters: 'صرف بیٹیاں ہیں، اس لیے والد کو 1/6 اور مقررہ حصوں کے بعد جو بچے وہ بھی ملتا ہے۔',
    fResid: 'اولاد نہیں ہے، اس لیے والد کو مقررہ حصوں کے بعد باقی سب ملتا ہے۔',
    sibSon: 'بیٹے کی موجودگی میں بہن بھائیوں کو حصہ نہیں ملتا۔',
    sibFather: 'والد کی موجودگی میں بہن بھائیوں کو حصہ نہیں ملتا۔',
    bResid: 'بیٹا اور والد نہیں ہیں، اس لیے مقررہ حصوں کے بعد جو بچے وہ بہن بھائیوں کو ملتا ہے۔',
    sWithBrother: 'بھائی کے ساتھ بہن کو بھائی کے حصے کا آدھا ملتا ہے۔',
    sWithDaughters: 'بیٹیوں کے ساتھ بہنیں مقررہ حصوں کے بعد بچا ہوا حصہ لیتی ہیں۔',
    sOne: 'اولاد، والد اور بھائی نہیں ہیں اور ایک ہی بہن ہے، اس لیے اس کا حصہ 1/2 ہے۔',
    sMany: 'اولاد، والد اور بھائی نہیں ہیں اور دو یا زیادہ بہنیں ہیں، اس لیے ان کا مشترکہ حصہ 2/3 ہے۔',
    awl: 'مقررہ حصوں کا مجموعہ ترکے سے زیادہ تھا، اس لیے سب کے حصے اسی تناسب سے کم کیے گئے (عول)۔',
    radd: 'باقی بچا ہوا حصہ لینے والا کوئی اور وارث نہیں، اس لیے وہ انہی ورثا کو ان کے حصوں کے تناسب سے واپس ملا (رد)۔',
    nothingLeft: 'اس صورت میں مقررہ حصوں کے بعد کچھ نہیں بچا۔',
    noHeir: 'کم از کم ایک وارث درج کریں۔',
  },
  en: {
    husband: 'Husband', wife: 'Wife', wives: 'Wives', mother: 'Mother', father: 'Father',
    son: 'Son', sons: 'Sons', daughter: 'Daughter', daughters: 'Daughters',
    brother: 'Full brother', brothers: 'Full brothers', sister: 'Full sister', sisters: 'Full sisters',
    hChild: "There are children, so the husband's share is 1/4.",
    hNoChild: "There are no children, so the husband's share is 1/2.",
    wChild: "There are children, so the wife's share is 1/8.",
    wNoChild: "There are no children, so the wife's share is 1/4.",
    wEqual: ' The wives share it equally.',
    mChild: "There are children, so the mother's share is 1/6.",
    mSibs: "There are two or more brothers and sisters, so the mother's share is 1/6.",
    mUmar: "The spouse and the father are both alive, so the mother gets 1/3 of what is left after the spouse's share.",
    mThird: "There are no children and fewer than two brothers and sisters, so the mother's share is 1/3.",
    cResid: 'After the fixed shares are given, what is left goes to the children.',
    dWithSon: "With a son, a daughter shares in the remainder: each daughter gets half of a son's share.",
    dOne: 'There is no son and only one daughter, so her share is 1/2.',
    dMany: 'There is no son and there are two or more daughters, so they share 2/3 together.',
    fSon: "There is a son, so the father's share is 1/6.",
    fDaughters: 'There are only daughters, so the father gets 1/6 plus whatever is left after the fixed shares.',
    fResid: 'There are no children, so the father gets everything left after the fixed shares.',
    sibSon: 'Brothers and sisters get no share when there is a son.',
    sibFather: 'Brothers and sisters get no share when the father is alive.',
    bResid: 'There is no son and no father, so what is left after the fixed shares goes to the brothers and sisters.',
    sWithBrother: "With a brother, a sister gets half of a brother's share.",
    sWithDaughters: 'With daughters, sisters take what is left after the fixed shares.',
    sOne: 'There are no children, father or brother, and only one sister, so her share is 1/2.',
    sMany: 'There are no children, father or brother, and two or more sisters, so they share 2/3 together.',
    awl: 'The fixed shares added up to more than the estate, so every share was reduced in the same proportion (awl).',
    radd: 'No other heir takes the remainder, so it returns to these heirs in proportion to their shares (radd).',
    nothingLeft: 'In this case nothing is left after the fixed shares.',
    noHeir: 'Enter at least one heir.',
  },
  ro: {
    husband: 'Shohar', wife: 'Biwi', wives: 'Biwiyan', mother: 'Walida', father: 'Walid',
    son: 'Beta', sons: 'Betay', daughter: 'Beti', daughters: 'Betiyan',
    brother: 'Saga bhai', brothers: 'Sagay bhai', sister: 'Sagi behen', sisters: 'Sagi behnein',
    hChild: 'Aulaad maujood hai, is liye shohar ka hissa 1/4 hai.',
    hNoChild: 'Aulaad nahin hai, is liye shohar ka hissa 1/2 hai.',
    wChild: 'Aulaad maujood hai, is liye biwi ka hissa 1/8 hai.',
    wNoChild: 'Aulaad nahin hai, is liye biwi ka hissa 1/4 hai.',
    wEqual: ' Yeh hissa sab biwiyon mein barabar taqseem hota hai.',
    mChild: 'Aulaad maujood hai, is liye walida ka hissa 1/6 hai.',
    mSibs: 'Do ya zyada behen bhai maujood hain, is liye walida ka hissa 1/6 hai.',
    mUmar: 'Shohar ya biwi aur walid dono maujood hain, is liye walida ko shohar ya biwi ka hissa nikalne ke baad baqi ka 1/3 milta hai.',
    mThird: 'Aulaad nahin aur behen bhai do se kam hain, is liye walida ka hissa 1/3 hai.',
    cResid: 'Muqarrara hissay dene ke baad jo bachta hai woh aulaad ko milta hai.',
    dWithSon: 'Betay ke saath beti baqi tarke mein shareek hoti hai: har beti ko betay ke hissay ka aadha milta hai.',
    dOne: 'Beta nahin hai aur aik hi beti hai, is liye us ka hissa 1/2 hai.',
    dMany: 'Beta nahin hai aur do ya zyada betiyan hain, is liye sab betiyon ka mushtarka hissa 2/3 hai.',
    fSon: 'Beta maujood hai, is liye walid ka hissa 1/6 hai.',
    fDaughters: 'Sirf betiyan hain, is liye walid ko 1/6 aur muqarrara hisson ke baad jo bache woh bhi milta hai.',
    fResid: 'Aulaad nahin hai, is liye walid ko muqarrara hisson ke baad baqi sab milta hai.',
    sibSon: 'Betay ki maujoodgi mein behen bhaiyon ko hissa nahin milta.',
    sibFather: 'Walid ki maujoodgi mein behen bhaiyon ko hissa nahin milta.',
    bResid: 'Beta aur walid nahin hain, is liye muqarrara hisson ke baad jo bache woh behen bhaiyon ko milta hai.',
    sWithBrother: 'Bhai ke saath behen ko bhai ke hissay ka aadha milta hai.',
    sWithDaughters: 'Betiyon ke saath behnein muqarrara hisson ke baad bacha hua hissa leti hain.',
    sOne: 'Aulaad, walid aur bhai nahin hain aur aik hi behen hai, is liye us ka hissa 1/2 hai.',
    sMany: 'Aulaad, walid aur bhai nahin hain aur do ya zyada behnein hain, is liye un ka mushtarka hissa 2/3 hai.',
    awl: 'Muqarrara hisson ka majmooa tarke se zyada tha, is liye sab ke hissay usi tanasub se kam kiye gaye (awl).',
    radd: 'Baqi bacha hua hissa lene wala koi aur waris nahin, is liye woh inhi warison ko un ke hisson ke tanasub se wapas mila (radd).',
    nothingLeft: 'Is soorat mein muqarrara hisson ke baad kuch nahin bacha.',
    noHeir: 'Kam az kam aik waris darj karein.',
  },
};

export function calculate(raw = {}, lang = 'ur') {
  const T = TEXT[lang] || TEXT.ur;
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
    put('husband', T.husband, 1, spouseShare, hasChild ? T.hChild : T.hNoChild, { isSpouse: true });
  }
  if (wives > 0) {
    spouseShare = hasChild ? fr(1, 8) : fr(1, 4);
    put('wives', wives > 1 ? T.wives : T.wife, wives, spouseShare,
      (hasChild ? T.wChild : T.wNoChild) + (wives > 1 ? T.wEqual : ''), { isSpouse: true });
  }

  // Mother
  if (mother) {
    if (hasChild || sibs >= 2) {
      put('mother', T.mother, 1, fr(1, 6), hasChild ? T.mChild : T.mSibs);
    } else if (father && hasSpouse) {
      put('mother', T.mother, 1, mul(fr(1, 3), sub(ONE, spouseShare)), T.mUmar);
    } else {
      put('mother', T.mother, 1, fr(1, 3), T.mThird);
    }
  }

  // Children
  if (hasSon) {
    put('sons', sons > 1 ? T.sons : T.son, sons, ZERO, T.cResid);
    resid = [{ key: 'sons', weight: 2 * sons }];
    if (daughters > 0) {
      put('daughters', daughters > 1 ? T.daughters : T.daughter, daughters, ZERO, T.dWithSon);
      resid.push({ key: 'daughters', weight: daughters });
    }
  } else if (daughters === 1) {
    put('daughters', T.daughter, 1, fr(1, 2), T.dOne);
  } else if (daughters > 1) {
    put('daughters', T.daughters, daughters, fr(2, 3), T.dMany);
  }

  // Father
  if (father) {
    if (hasSon) {
      put('father', T.father, 1, fr(1, 6), T.fSon);
    } else if (daughters > 0) {
      put('father', T.father, 1, fr(1, 6), T.fDaughters);
      resid = [{ key: 'father', weight: 1 }];
    } else {
      put('father', T.father, 1, ZERO, T.fResid);
      resid = [{ key: 'father', weight: 1 }];
    }
  }

  // Full siblings
  if (sibs > 0) {
    const bLabel = brothers > 1 ? T.brothers : T.brother;
    const sLabel = sisters > 1 ? T.sisters : T.sister;
    if (hasSon || father) {
      const why = hasSon ? T.sibSon : T.sibFather;
      if (brothers > 0) put('brothers', bLabel, brothers, ZERO, why, { blocked: true });
      if (sisters > 0) put('sisters', sLabel, sisters, ZERO, why, { blocked: true });
    } else if (brothers > 0) {
      put('brothers', bLabel, brothers, ZERO, T.bResid);
      resid = [{ key: 'brothers', weight: 2 * brothers }];
      if (sisters > 0) {
        put('sisters', sLabel, sisters, ZERO, T.sWithBrother);
        resid.push({ key: 'sisters', weight: sisters });
      }
    } else if (daughters > 0) {
      put('sisters', sLabel, sisters, ZERO, T.sWithDaughters);
      resid = [{ key: 'sisters', weight: 1 }];
    } else if (sisters === 1) {
      put('sisters', sLabel, 1, fr(1, 2), T.sOne);
    } else {
      put('sisters', sLabel, sisters, fr(2, 3), T.sMany);
    }
  }

  const list = Object.values(E);
  if (list.length === 0) {
    return { ok: false, error: T.noHeir };
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
        e.reasons.push(T.awl);
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
            e.reasons.push(T.radd);
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
      if (!gt(e.share, ZERO)) e.reasons.push(T.nothingLeft);
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

// ---- Asset split ----
// Splits each listed asset (cash, gold, house, others) between the heirs using the shares
// calculate() produced, and adds a total for every heir and for the whole estate.
// Amounts are worked out from the exact fraction and rounded to the nearest rupee only at the end.
// Gold can also be given in tola; then the share of gold is shown in tola as well.
export const ASSET_KINDS = ['cash', 'gold', 'house', 'other'];

// ---- Before division: funeral costs, then debts, then the will (at most one third of what is left) ----
// Order and the one third limit follow the general rule; a will in favour of an heir needs the other heirs' consent,
// so the app tells the user it must not be for an heir.
export function deductions(gross, { funeral = 0, debts = 0, will = 0 } = {}) {
  const pos = (v) => Math.max(0, Number(v) || 0);
  const g = pos(gross);
  const f = Math.min(pos(funeral), g);
  const afterFuneral = g - f;
  const d = Math.min(pos(debts), afterFuneral);
  const afterDebts = afterFuneral - d;
  const maxWill = afterDebts / 3;
  const asked = pos(will);
  const w = Math.min(asked, maxWill);
  return {
    gross: g,
    funeral: f,
    debts: d,
    will: w,
    willAsked: asked,
    willCapped: asked > maxWill + 1e-9,
    maxWill,
    net: afterDebts - w,
    insolvent: g > 0 && afterDebts <= 0,
    debtsUnpaid: Math.max(0, pos(debts) - d),
    any: f + d + w > 0,
  };
}

// ---- Keeping an asset: one heir group keeps it (for example the brothers keep the house) and pays the others ----
export function buyout(result, value, keeperKey) {
  if (!result || !result.ok) return null;
  const V = Math.max(0, Number(value) || 0);
  const keeper = result.rows.find((r) => r.key === keeperKey);
  if (!V || !keeper) return null;
  const own = V * fnum(keeper.total);
  const pays = V - own;
  return {
    value: V,
    keeper: {
      key: keeper.key, label: keeper.label, count: keeper.count,
      ownShare: Math.round(own), pays: Math.round(pays), paysEach: Math.round(pays / keeper.count),
    },
    others: result.rows.filter((r) => r.key !== keeperKey).map((r) => ({
      key: r.key, label: r.label, count: r.count, blocked: r.blocked,
      receivesEach: Math.round(V * fnum(r.each)),
      receivesGroup: Math.round(V * fnum(r.total)),
    })),
    unallocated: result.unallocated && result.unallocated.n > 0 ? Math.round(V * fnum(result.unallocated)) : 0,
  };
}

export function splitAssets(result, assets = [], net = null) {
  if (!result || !result.ok) return null;
  const list = (assets || [])
    .map((a) => ({
      kind: ASSET_KINDS.includes(a.kind) ? a.kind : 'other',
      name: String(a.name || '').trim(),
      value: Math.max(0, Number(a.value) || 0),
      tola: Math.max(0, Number(a.tola) || 0) || null,
    }))
    .filter((a) => a.value > 0);
  if (!list.length) return null;

  const gross = list.reduce((s, a) => s + a.value, 0);
  // After deductions every asset is reduced in the same proportion.
  const factor = net != null && gross > 0 ? Math.max(0, Math.min(1, Number(net) / gross)) : 1;
  for (const a of list) { a.gross = a.value; a.value = a.value * factor; if (a.tola) a.tola = Math.round(a.tola * factor * 1000) / 1000; }
  const estate = gross * factor;
  const round = (x) => Math.round(x);
  const tolaOf = (t, f) => Math.round(t * fnum(f) * 1000) / 1000;

  const rows = result.rows.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.count,
    each: r.each,
    blocked: r.blocked,
    perAsset: list.map((a) => ({
      each: round(a.value * fnum(r.each)),
      group: round(a.value * fnum(r.total)),
      tolaEach: a.tola ? tolaOf(a.tola, r.each) : null,
    })),
    totalEach: round(estate * fnum(r.each)),
    totalGroup: round(estate * fnum(r.total)),
  }));

  const unallocated = result.unallocated && result.unallocated.n > 0
    ? {
      perAsset: list.map((a) => round(a.value * fnum(result.unallocated))),
      total: round(estate * fnum(result.unallocated)),
    }
    : null;

  return { assets: list, rows, unallocated, estate: round(estate), gross, factor };
}
