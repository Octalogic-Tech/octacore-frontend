import { personRowSchema } from '@/features/people/schema';
import { peopleRows, resourceRows } from '@/test/fixtures/projects';
import { resourceRowSchema } from './schema';
import { RETAINER_HOURS, teamMargin } from './team-margin';

const resource = (over: Record<string, unknown>) => resourceRowSchema.parse({ ...resourceRows[0], ...over });
const person = (id: number, monthlySalaryPaise: number | null) =>
  personRowSchema.parse({ ...peopleRows[0], id, monthlySalaryPaise });

// Rates and the billing are in whole US cents (a rate of 15000 is $150.00 an hour); a salary is in whole INR paise and is
// counted in US cents at India's rate, so 80 rupees to the dollar makes 8,000 paise one dollar (100 cents).
const RATE = 80;

describe('teamMargin', () => {
  it('bills the resources for the 160-hour month the retainer invoice uses', () => {
    expect(RETAINER_HOURS).toBe(160);
  });

  it('adds up two counted resources, each matched to its own person', () => {
    const resources = [
      resource({ id: 1, personId: 1, rateCents: 15000 }),
      resource({ id: 2, personId: 2, rateCents: 7500 }),
    ];
    // The people come in the other order: matching is by id.
    const people = [person(2, 38_400_000), person(1, 44_800_000)];
    // billed (15,000 + 7,500) x 160 = 3,600,000; cost 560,000 + 480,000 = 1,040,000; margin 2,560,000;
    // 2,560,000 / 3,600,000 = 71.11% -> 71.
    expect(teamMargin(resources, people, RATE)).toEqual({
      counted: 2,
      total: 2,
      billed: 3_600_000,
      cost: 1_040_000,
      margin: 2_560_000,
      percent: 71,
    });
  });

  it('leaves out a resource with no person, and says how many it counted of how many there are', () => {
    const resources = [
      resource({ id: 1, personId: 1, rateCents: 5000 }),
      resource({ id: 2, personId: null, person: null, rateCents: 9000 }),
    ];
    // billed 5,000 x 160 = 800,000; a salary of 40,000,000 paise at 80 rupees to the dollar costs 500,000 cents;
    // margin 300,000; 300,000 / 800,000 = 37.5% -> 38 (a half rounds up).
    expect(teamMargin(resources, [person(1, 40_000_000)], RATE)).toEqual({
      counted: 1,
      total: 2,
      billed: 800_000,
      cost: 500_000,
      margin: 300_000,
      percent: 38,
    });
  });

  it.each([
    ['a person with no salary', [resource({ personId: 1, rateCents: 5000 })], [person(1, null)]],
    ['a Qty above 1', [resource({ personId: 1, rateCents: 5000, headcount: 3 })], [person(1, 40_000_000)]],
    [
      'a person who has been deleted (not in the people list)',
      [resource({ personId: 7, rateCents: 5000 })],
      [person(1, 40_000_000)],
    ],
    ['no resources', [], [person(1, 40_000_000)]],
  ])('counts nothing for %s', (_name, resources, people) => {
    expect(teamMargin(resources, people, RATE)).toMatchObject({
      counted: 0,
      billed: 0,
      cost: 0,
      margin: 0,
      percent: null,
      total: resources.length,
    });
  });

  describe('with no usable India rate', () => {
    const resources = [resource({ personId: 1, rateCents: 5000 })];
    const people = [person(1, 40_000_000)];

    it.each([
      ['no rate', null],
      ['a rate of zero', 0],
      ['a negative rate', -80],
    ])('counts nothing for %s, however many resources have a salaried person', (_name, rate) => {
      expect(teamMargin(resources, people, rate)).toEqual({
        counted: 0,
        total: 1,
        billed: 0,
        cost: 0,
        margin: 0,
        percent: null,
      });
    });
  });

  it('counts a salary of 0 as a salary', () => {
    // billed 500 x 160 = 80,000; cost 0; margin 80,000; 80,000 / 80,000 = 100%.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 0)], RATE)).toMatchObject({
      counted: 1,
      billed: 80_000,
      cost: 0,
      margin: 80_000,
      percent: 100,
    });
  });

  it('reports a cost above the billing as a negative margin, with the percentage of its size', () => {
    // billed 500 x 160 = 80,000; cost 90,000 cents (7,200,000 paise at 80); margin -10,000; 10,000 / 80,000 = 12.5% -> 13
    // (a half rounds away from zero).
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 7_200_000)], RATE)).toMatchObject({
      billed: 80_000,
      cost: 90_000,
      margin: -10_000,
      percent: 13,
    });
  });

  it('rounds a half up for a positive margin too', () => {
    // billed 80,000; cost 70,000; margin 10,000; 12.5% -> 13.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 5_600_000)], RATE)).toMatchObject({
      margin: 10_000,
      percent: 13,
    });
  });

  it('rounds a quarter of a percent down, and a zero margin is 0%', () => {
    // billed 80,000; cost 80,000; margin 0; 0%.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 6_400_000)], RATE)).toMatchObject({
      margin: 0,
      percent: 0,
    });
    // billed 800,000; cost 798,000; margin 2,000; 2,000 / 800,000 = 0.25% -> 0.
    expect(teamMargin([resource({ personId: 1, rateCents: 5000 })], [person(1, 63_840_000)], RATE)).toMatchObject({
      margin: 2_000,
      percent: 0,
    });
  });

  it('works to the cent: a rate of $85.50 against a salary of 44,806,000 paise at 80', () => {
    // billed 8,550 x 160 = 1,368,000; cost 44,806,000 / 80 = 560,075; margin 807,925; 807,925 / 1,368,000 = 59.06% -> 59.
    expect(teamMargin([resource({ personId: 1, rateCents: 8550 })], [person(1, 44_806_000)], RATE)).toEqual({
      counted: 1,
      total: 1,
      billed: 1_368_000,
      cost: 560_075,
      margin: 807_925,
      percent: 59,
    });
  });

  it('has no percentage, and does not divide by zero, when the counted rates are all 0', () => {
    expect(teamMargin([resource({ personId: 1, rateCents: 0 })], [person(1, 40_000_000)], RATE)).toEqual({
      counted: 1,
      total: 1,
      billed: 0,
      cost: 500_000,
      margin: -500_000,
      percent: null,
    });
  });

  describe('turning a salary in paise into US cents', () => {
    const costOf = (paise: number, rate: number) =>
      teamMargin([resource({ personId: 1, rateCents: 0 })], [person(1, paise)], rate).cost;

    it('rounds half up, like the service’s own conversion', () => {
      // 1 paisa at 3 rupees to the dollar is a third of a cent, 3 paise is one cent, 5 paise is 1.67 cents.
      expect(costOf(1, 3)).toBe(0);
      expect(costOf(3, 3)).toBe(1);
      expect(costOf(5, 3)).toBe(2);
      // A true half goes up: 1 paisa at 2 is 0.5 cents, 3 paise is 1.5, 5 paise is 2.5.
      expect(costOf(1, 2)).toBe(1);
      expect(costOf(3, 2)).toBe(2);
      expect(costOf(5, 2)).toBe(3);
    });

    it('works on a rate with decimals: 85,000 rupees at 88.25 to the dollar', () => {
      // 8,500,000 / 88.25 = 96,317.28 -> 96,317.
      expect(costOf(8_500_000, 88.25)).toBe(96_317);
    });

    it('converts each person on their own, then adds, as each salary is its own figure', () => {
      // Two salaries of 1 paisa at 2: each is a half cent and goes up to 1, so the two cost 2, not the 1 of their sum.
      const resources = [resource({ id: 1, personId: 1, rateCents: 0 }), resource({ id: 2, personId: 2, rateCents: 0 })];
      expect(teamMargin(resources, [person(1, 1), person(2, 1)], 2).cost).toBe(2);
    });

    it('stays exact for the largest salary the service takes', () => {
      // 10,000,000,000 paise at 80 is exactly 125,000,000 cents.
      expect(costOf(10_000_000_000, 80)).toBe(125_000_000);
      // 10,000,000,000 / 88.25 = 113,314,447.59 -> 113,314,448.
      expect(costOf(10_000_000_000, 88.25)).toBe(113_314_448);
    });
  });
});
