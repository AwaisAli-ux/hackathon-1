import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, fstr, fr } from '../public/calc.js';

const shares = (input) => {
  const r = calculate(input);
  assert.equal(r.ok, true);
  return { r, each: Object.fromEntries(r.rows.map((x) => [x.key, fstr(x.each)])) };
};

const totalIsOne = (r) => {
  let n = 0, d = 1;
  for (const row of r.rows) { n = n * row.total.d + row.total.n * d; d = d * row.total.d; }
  n = n * r.unallocated.d + r.unallocated.n * d; d = d * r.unallocated.d;
  assert.deepEqual(fr(n, d), fr(1));
};

test('wife, 2 sons, 1 daughter', () => {
  const { r, each } = shares({ deceasedGender: 'male', wives: 1, sons: 2, daughters: 1 });
  assert.deepEqual(each, { wives: '1/8', sons: '7/20', daughters: '7/40' });
  totalIsOne(r);
});

test('husband, father, mother (umariyyatayn)', () => {
  const { r, each } = shares({ deceasedGender: 'female', husband: true, father: true, mother: true });
  assert.deepEqual(each, { husband: '1/2', father: '1/3', mother: '1/6' });
  totalIsOne(r);
});

test('wife, father, mother (umariyyatayn)', () => {
  const { each } = shares({ deceasedGender: 'male', wives: 1, father: true, mother: true });
  assert.deepEqual(each, { wives: '1/4', father: '1/2', mother: '1/4' });
});

test('husband, 2 daughters, father, mother (awl to 15)', () => {
  const { r, each } = shares({ deceasedGender: 'female', husband: true, daughters: 2, father: true, mother: true });
  assert.deepEqual(each, { husband: '1/5', daughters: '4/15', father: '2/15', mother: '2/15' });
  assert.equal(r.flags.awl, true);
  totalIsOne(r);
});

test('1 daughter and mother only (radd)', () => {
  const { r, each } = shares({ deceasedGender: 'male', daughters: 1, mother: true });
  assert.deepEqual(each, { daughters: '3/4', mother: '1/4' });
  assert.equal(r.flags.radd, true);
});

test('wife, 1 daughter, 1 sister (sister takes remainder)', () => {
  const { r, each } = shares({ deceasedGender: 'male', wives: 1, daughters: 1, sisters: 1 });
  assert.deepEqual(each, { wives: '1/8', daughters: '1/2', sisters: '3/8' });
  totalIsOne(r);
});

test('husband and 2 sisters (awl to 7)', () => {
  const { each } = shares({ deceasedGender: 'female', husband: true, sisters: 2 });
  assert.deepEqual(each, { husband: '3/7', sisters: '2/7' });
});

test('father, mother, 2 brothers (brothers blocked, mother 1/6)', () => {
  const { r, each } = shares({ deceasedGender: 'male', father: true, mother: true, brothers: 2 });
  assert.deepEqual(each, { father: '5/6', mother: '1/6', brothers: '0' });
  assert.equal(r.rows.find((x) => x.key === 'brothers').blocked, true);
});

test('father with 1 daughter takes 1/6 plus remainder', () => {
  const { each } = shares({ deceasedGender: 'male', daughters: 1, father: true });
  assert.deepEqual(each, { daughters: '1/2', father: '1/2' });
});

test('mother, 1 brother, 2 sisters', () => {
  const { r, each } = shares({ deceasedGender: 'male', mother: true, brothers: 1, sisters: 2 });
  assert.deepEqual(each, { mother: '1/6', brothers: '5/12', sisters: '5/24' });
  totalIsOne(r);
});

test('2 wives, 1 son: wives split 1/8', () => {
  const { each } = shares({ deceasedGender: 'male', wives: 2, sons: 1 });
  assert.deepEqual(each, { wives: '1/16', sons: '7/8' });
});

test('wife only: remainder is left unallocated', () => {
  const { r, each } = shares({ deceasedGender: 'male', wives: 1 });
  assert.deepEqual(each, { wives: '1/4' });
  assert.equal(fstr(r.unallocated), '3/4');
});

test('amounts follow the estate', () => {
  const r = calculate({ deceasedGender: 'male', wives: 1, sons: 2, daughters: 1, estate: 4000000 });
  assert.equal(r.rows.find((x) => x.key === 'daughters').amountEach, 700000);
});

test('no heirs is an error', () => {
  assert.equal(calculate({}).ok, false);
});
