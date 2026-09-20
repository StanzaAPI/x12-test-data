// ANSI X12 envelope and transaction builders. Everything produced here is
// synthetic: fixed-width ISA fields, invented identifiers, no real payer,
// provider, or patient data.

import { rng as makeRng } from './rng.mjs';

export const DEFAULT_DELIMITERS = {
  element: '*',
  segment: '~',
  component: ':',
  repetition: '^',
};

export function pad(value, width, fill = ' ') {
  return (String(value) + fill.repeat(width)).slice(0, width);
}

export function isa({ control = 1, date = '260101', time = '1200', sender = 'SYNTHSUB', receiver = 'SYNTHRCV', delimiters = DEFAULT_DELIMITERS }) {
  const d = delimiters;
  const segment =
    [
      'ISA',
      '00',
      pad('', 10),
      '00',
      pad('', 10),
      'ZZ',
      pad(sender, 15),
      'ZZ',
      pad(receiver, 15),
      date,
      time,
      d.repetition,
      '00501',
      pad(String(control % 1e9), 9, '0'),
      '0',
      'P',
      d.component,
    ].join(d.element) + d.segment;

  if (segment.length !== 106) {
    throw new Error(`ISA segment must be exactly 106 characters, got ${segment.length}`);
  }
  return segment;
}

export function gs({ type = 'HC', control = 1, version = '005010X222A1', delimiters = DEFAULT_DELIMITERS }) {
  const d = delimiters;
  return ['GS', type, 'SYNTHSUB', 'SYNTHRCV', '20260101', '1200', String(control), 'X', version].join(d.element) + d.segment;
}

export function ge(control = 1, delimiters = DEFAULT_DELIMITERS) {
  return ['GE', '1', String(control)].join(delimiters.element) + delimiters.segment;
}

export function iea(control = 1, delimiters = DEFAULT_DELIMITERS) {
  return ['IEA', '1', pad(String(control % 1e9), 9, '0')].join(delimiters.element) + delimiters.segment;
}

export function st(type, control, delimiters = DEFAULT_DELIMITERS) {
  return ['ST', type, pad(String(control % 1e4), 4, '0'), '005010X222A1'].join(delimiters.element) + delimiters.segment;
}

export function se(segmentCount, control, delimiters = DEFAULT_DELIMITERS) {
  return ['SE', String(segmentCount), pad(String(control % 1e4), 4, '0')].join(delimiters.element) + delimiters.segment;
}

/** ST..SE block for an 837P claim submission. */
export function seg837p(rng, claims = 5, delimiters = DEFAULT_DELIMITERS) {
  const e = delimiters.element;
  const s = delimiters.segment;
  const LAST = ['SMITH', 'JOHNSON', 'PATEL', 'GARCIA', 'NGUYEN', 'BROWN', 'KIM', 'MUELLER'];
  const FIRST = ['ALEX', 'JAMIE', 'PRIYA', 'DIEGO', 'LINH', 'SAM', 'MORGAN', 'NOOR'];
  const CITIES = ['ANAHEIM', 'AUSTIN', 'BOULDER', 'COLUMBUS', 'RENO', 'TAMPA'];
  const ICD10 = ['I10', 'E119', 'M5450', 'J069', 'R079', 'Z0000'];
  const CPT = ['99213', '99214', '99215', '99385', '99395'];

  const body = [
    ['BHT', '0019', '00', rng.digits(6), '20260101', '1200', 'CH'].join(e) + s,
    ['NM1', '41', '2', 'SYNTHETIC BILLING', '', '', '', '', '46', rng.digits(6)].join(e) + s,
    ['PER', 'IC', 'SYNTH CONTACT', 'TE', rng.digits(10)].join(e) + s,
    ['NM1', '40', '2', 'SYNTHETIC PAYER', '', '', '', '', '46', rng.digits(6)].join(e) + s,
    ['HL', '1', '', '20', '1'].join(e) + s,
    ['PRV', 'BI', 'PXC', '207Q00000X'].join(e) + s,
    ['NM1', '85', '1', rng.pick(LAST), rng.pick(FIRST), '', '', 'XX', rng.digits(10)].join(e) + s,
    ['N3', `${1 + rng.int(999)} ${rng.pick(['ELM', 'MAPLE'])} AVE`].join(e) + s,
    ['N4', rng.pick(CITIES), rng.pick(['CA', 'TX', 'CO']), rng.digits(5)].join(e) + s,
    ['REF', 'EI', rng.digits(9)].join(e) + s,
  ];

  for (let i = 0; i < claims; i++) {
    const charge = (50 + rng.next() * 950).toFixed(2);
    body.push(
      ['HL', String(i + 2), '1', '22', '0'].join(e) + s,
      ['SBR', 'P', '18', '', '', '', '', '', 'CI'].join(e) + s,
      ['NM1', 'IL', '1', rng.pick(LAST), rng.pick(FIRST), '', '', 'MI', `S${rng.digits(8)}`].join(e) + s,
      ['N3', `${1 + rng.int(999)} ${rng.pick(['MAIN', 'OAK', 'PINE'])} STREET`].join(e) + s,
      ['N4', rng.pick(CITIES), rng.pick(['CA', 'TX', 'CO', 'OH']), rng.digits(5)].join(e) + s,
      ['DMG', 'D8', rng.pick(['19481118', '19720325', '19950702', '20010116']), rng.pick(['M', 'F'])].join(e) + s,
      ['REF', 'SY', rng.digits(9)].join(e) + s,
      ['NM1', 'PR', '2', 'SYNTHETIC PAYER', '', '', '', '', 'PI', rng.digits(9)].join(e) + s,
      ['CLM', `SYN${rng.digits(7)}`, charge, '', '', '11:B:1', 'Y', 'A', 'Y', 'Y'].join(e) + s,
      ['HI', `ABK:${rng.pick(ICD10)}`].join(e) + s,
      ['LX', '1'].join(e) + s,
      ['SV1', `HC:${rng.pick(CPT)}:25`, charge, 'UN', '1', '', '', '1:2'].join(e) + s,
      ['DTP', '472', 'D8', '20260101'].join(e) + s
    );
  }
  return body;
}

/** ST..SE block for an 835 remittance advice. */
export function seg835(rng, delimiters = DEFAULT_DELIMITERS) {
  const e = delimiters.element;
  const s = delimiters.segment;
  const amount = (10 + rng.next() * 1000).toFixed(2);
  return [
    ['BPR', 'I', amount, 'C', 'ACH', 'CCP', '01', rng.digits(9), 'DA', rng.digits(10), rng.digits(10), '', '01', rng.digits(9), 'DA', rng.digits(10), '20260101'].join(e) + s,
    ['TRN', '1', rng.digits(10), rng.digits(10)].join(e) + s,
    ['N1', 'PR', 'SYNTHETIC PAYER', 'XV', rng.digits(5)].join(e) + s,
    ['N1', 'PE', 'SYNTHETIC PAYEE', 'XX', rng.digits(10)].join(e) + s,
    ['CLP', `PCN${rng.digits(5)}`, '1', '500.00', amount, '350.00', 'MC', rng.digits(10), '11', '1'].join(e) + s,
    ['NM1', 'QC', '1', 'DOE', 'JOHN', '', '', 'MI', `MEM${rng.digits(6)}`].join(e) + s,
    ['CAS', 'CO', '45', '350.00'].join(e) + s,
    ['SVC', 'HC:99213', amount, '120.00', '', '1'].join(e) + s,
    ['DTM', '472', '20260101'].join(e) + s,
  ];
}

/** ST..SE block for a 271 eligibility response. */
export function seg271(rng, delimiters = DEFAULT_DELIMITERS) {
  const e = delimiters.element;
  const s = delimiters.segment;
  return [
    ['BHT', '0022', '11', `REQ${rng.digits(4)}`, '20260101', '1500'].join(e) + s,
    ['HL', '1', '', '20', '1'].join(e) + s,
    ['NM1', 'PR', '2', 'SYNTHETIC PAYER', '', '', '', '', 'PI', `PAYER${rng.digits(4)}`].join(e) + s,
    ['HL', '2', '1', '21', '1'].join(e) + s,
    ['NM1', '1P', '2', 'SYNTHETIC HOSPITAL', '', '', '', '', 'XX', rng.digits(10)].join(e) + s,
    ['HL', '3', '2', '22', '0'].join(e) + s,
    ['NM1', 'IL', '1', 'SMITH', 'JANE', '', '', 'MI', `MEM${rng.digits(6)}`].join(e) + s,
    ['DMG', 'D8', '19900325', 'F'].join(e) + s,
    ['EB', '1', 'IND', '30'].join(e) + s,
    ['EB', 'B', '', '98', '', '', '25.00'].join(e) + s,
  ];
}

export function transactionBlock(type, rng, options = {}) {
  const { claims = 5, control = 1, delimiters = DEFAULT_DELIMITERS } = options;
  const body =
    type === '835' ? seg835(rng, delimiters) : type === '271' ? seg271(rng, delimiters) : seg837p(rng, claims, delimiters);
  return st(type, control, delimiters) + body.join('') + se(body.length + 1, control, delimiters);
}

export function validCorpus({ type = '837', transactions = 1000, claims = 5, seed = 42, delimiters = DEFAULT_DELIMITERS }) {
  const rng = makeRng(seed);
  const chunks = [];
  let control = 0;
  for (let i = 0; i < transactions; i++) {
    control++;
    chunks.push(isa({ control, delimiters }), gs({ type: type === '835' ? 'HP' : type === '271' ? 'HB' : 'HC', control, delimiters }));
    chunks.push(transactionBlock(type, rng, { claims, control, delimiters }));
    chunks.push(ge(control, delimiters), iea(control, delimiters));
  }
  return chunks.join('');
}

export function freshRng(seed) {
  return makeRng(seed);
}
