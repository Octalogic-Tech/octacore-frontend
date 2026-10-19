import { personRowSchema } from '@/features/people/schema';
import { peopleRows, resourceRows } from '@/test/fixtures/projects';
import { resourceRowSchema } from './schema';
import { RETAINER_HOURS, teamMargin } from './team-margin';

const resource = (over: Record<string, unknown>) => resourceRowSchema.parse({ ...resourceRows[0], ...over });
const person = (id: number, monthlySalaryCents: number | null) =>
  personRowSchema.parse({ ...peopleRows[0], id, monthlySalaryCents });

// Every figure is in whole US cents: a rate of 15000 is $150.00 an hour.
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
    const people = [person(2, 480000), person(1, 560000)];
    // billed (15,000 + 7,500) x 160 = 3,600,000; cost 560,000 + 480,000 = 1,040,000; margin 2,560,000;
    // 2,560,000 / 3,600,000 = 71.11% -> 71.
    expect(teamMargin(resources, people)).toEqual({
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
    // billed 5,000 x 160 = 800,000; cost 500,000; margin 300,000; 300,000 / 800,000 = 37.5% -> 38 (a half rounds up).
    expect(teamMargin(resources, [person(1, 500000)])).toEqual({
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
    ['a Qty above 1', [resource({ personId: 1, rateCents: 5000, headcount: 3 })], [person(1, 500000)]],
    [
      'a person who has been deleted (not in the people list)',
      [resource({ personId: 7, rateCents: 5000 })],
      [person(1, 500000)],
    ],
    ['no resources', [], [person(1, 500000)]],
  ])('counts nothing for %s', (_name, resources, people) => {
    expect(teamMargin(resources, people)).toMatchObject({
      counted: 0,
      billed: 0,
      cost: 0,
      margin: 0,
      percent: null,
      total: resources.length,
    });
  });

  it('counts a salary of 0 as a salary', () => {
    // billed 500 x 160 = 80,000; cost 0; margin 80,000; 80,000 / 80,000 = 100%.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 0)])).toMatchObject({
      counted: 1,
      billed: 80_000,
      cost: 0,
      margin: 80_000,
      percent: 100,
    });
  });

  it('reports a cost above the billing as a negative margin, with the percentage of its size', () => {
    // billed 500 x 160 = 80,000; cost 90,000; margin -10,000; 10,000 / 80,000 = 12.5% -> 13 (a half rounds away from
    // zero).
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 90000)])).toMatchObject({
      billed: 80_000,
      cost: 90_000,
      margin: -10_000,
      percent: 13,
    });
  });

  it('rounds a half up for a positive margin too', () => {
    // billed 80,000; cost 70,000; margin 10,000; 12.5% -> 13.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 70000)])).toMatchObject({
      margin: 10_000,
      percent: 13,
    });
  });

  it('rounds a quarter of a percent down, and a zero margin is 0%', () => {
    // billed 80,000; cost 80,000; margin 0; 0%.
    expect(teamMargin([resource({ personId: 1, rateCents: 500 })], [person(1, 80000)])).toMatchObject({
      margin: 0,
      percent: 0,
    });
    // billed 800,000; cost 798,000; margin 2,000; 2,000 / 800,000 = 0.25% -> 0.
    expect(teamMargin([resource({ personId: 1, rateCents: 5000 })], [person(1, 798000)])).toMatchObject({
      margin: 2_000,
      percent: 0,
    });
  });

  it('works to the cent: a rate of $85.50 against a salary of $5,600.75', () => {
    // billed 8,550 x 160 = 1,368,000; cost 560,075; margin 807,925; 807,925 / 1,368,000 = 59.06% -> 59.
    expect(teamMargin([resource({ personId: 1, rateCents: 8550 })], [person(1, 560075)])).toEqual({
      counted: 1,
      total: 1,
      billed: 1_368_000,
      cost: 560_075,
      margin: 807_925,
      percent: 59,
    });
  });

  it('has no percentage, and does not divide by zero, when the counted rates are all 0', () => {
    expect(teamMargin([resource({ personId: 1, rateCents: 0 })], [person(1, 500000)])).toEqual({
      counted: 1,
      total: 1,
      billed: 0,
      cost: 500_000,
      margin: -500_000,
      percent: null,
    });
  });
});
