import { personRowSchema } from '@/features/people/schema';
import { peopleRows, resourceRows } from '@/test/fixtures/projects';
import { resourceRowSchema } from './schema';
import { RETAINER_HOURS, teamMargin } from './team-margin';

const resource = (over: Record<string, unknown>) => resourceRowSchema.parse({ ...resourceRows[0], ...over });
const person = (id: number, monthlySalary: number | null) =>
  personRowSchema.parse({ ...peopleRows[0], id, monthlySalary });

describe('teamMargin', () => {
  it('bills the resources for the 160-hour month the retainer invoice uses', () => {
    expect(RETAINER_HOURS).toBe(160);
  });

  it('adds up two counted resources, each matched to its own person', () => {
    const resources = [resource({ id: 1, personId: 1, rate: 50 }), resource({ id: 2, personId: 2, rate: 40 })];
    // The people come in the other order: matching is by id.
    const people = [person(2, 4800), person(1, 5000)];
    // billed (50 + 40) x 160 = 14,400; cost 5,000 + 4,800 = 9,800; margin 4,600; 4,600 / 14,400 = 31.94% -> 32.
    expect(teamMargin(resources, people)).toEqual({
      counted: 2,
      total: 2,
      billed: 14400,
      cost: 9800,
      margin: 4600,
      percent: 32,
    });
  });

  it('leaves out a resource with no person, and says how many it counted of how many there are', () => {
    const resources = [resource({ id: 1, personId: 1, rate: 50 }), resource({ id: 2, personId: null, person: null, rate: 90 })];
    // billed 50 x 160 = 8,000; cost 5,000; margin 3,000; 3,000 / 8,000 = 37.5% -> 38 (a half rounds up).
    expect(teamMargin(resources, [person(1, 5000)])).toEqual({
      counted: 1,
      total: 2,
      billed: 8000,
      cost: 5000,
      margin: 3000,
      percent: 38,
    });
  });

  it.each([
    ['a person with no salary', [resource({ personId: 1, rate: 50 })], [person(1, null)]],
    ['a Qty above 1', [resource({ personId: 1, rate: 50, headcount: 3 })], [person(1, 5000)]],
    ['a person who has been deleted (not in the people list)', [resource({ personId: 7, rate: 50 })], [person(1, 5000)]],
    ['no resources', [], [person(1, 5000)]],
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
    // billed 5 x 160 = 800; cost 0; margin 800; 800 / 800 = 100%.
    expect(teamMargin([resource({ personId: 1, rate: 5 })], [person(1, 0)])).toMatchObject({
      counted: 1,
      billed: 800,
      cost: 0,
      margin: 800,
      percent: 100,
    });
  });

  it('reports a cost above the billing as a negative margin, with the percentage of its size', () => {
    // billed 5 x 160 = 800; cost 900; margin -100; 100 / 800 = 12.5% -> 13 (a half rounds away from zero).
    expect(teamMargin([resource({ personId: 1, rate: 5 })], [person(1, 900)])).toMatchObject({
      billed: 800,
      cost: 900,
      margin: -100,
      percent: 13,
    });
  });

  it('rounds a half up for a positive margin too', () => {
    // billed 800; cost 700; margin 100; 12.5% -> 13.
    expect(teamMargin([resource({ personId: 1, rate: 5 })], [person(1, 700)])).toMatchObject({ margin: 100, percent: 13 });
  });

  it('rounds a quarter of a percent down, and a zero margin is 0%', () => {
    // billed 800; cost 800; margin 0; 0%.
    expect(teamMargin([resource({ personId: 1, rate: 5 })], [person(1, 800)])).toMatchObject({ margin: 0, percent: 0 });
    // billed 8,000; cost 7,980; margin 20; 20 / 8,000 = 0.25% -> 0.
    expect(teamMargin([resource({ personId: 1, rate: 50 })], [person(1, 7980)])).toMatchObject({ margin: 20, percent: 0 });
  });

  it('has no percentage, and does not divide by zero, when the counted rates are all 0', () => {
    expect(teamMargin([resource({ personId: 1, rate: 0 })], [person(1, 5000)])).toEqual({
      counted: 1,
      total: 1,
      billed: 0,
      cost: 5000,
      margin: -5000,
      percent: null,
    });
  });
});
