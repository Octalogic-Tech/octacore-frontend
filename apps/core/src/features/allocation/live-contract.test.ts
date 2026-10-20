import { z } from 'zod';
import { personRowSchema } from '@/features/people/schema';
import { unwrap } from '@/lib/core-api';
import { localToday } from '@/lib/format';
import { signInLive, type LiveSend } from '@/test/live-api';
import { cardsOf } from './board';
import { allocationRowSchema, allocationRowsSchema, BENCH, toAllocationBody, toAllocationFormValues } from './schema';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds people, a project or two and their allocation
// entries, changes and deletes them again; deletes are soft, so the rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5013
//   (here, in apps/core)   CORE_API_WRITE_URL=http://127.0.0.1:5013/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec vitest run src/features/allocation/live-contract.test.ts
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const createdSchema = z.object({ id: z.number().int() });

/** What the ledger shows when a card already has an entry on a date: the form puts it on the date field. */
const DUPLICATE_DATE = 'This person already has an entry for that card on that date; edit it instead';
const KEEPS_ONE = 'A person keeps at least one card';
const NO_SUCH_CARD = 'That card does not exist';

const createPerson = async (name: string) =>
  unwrap(await (await send('POST', '/people', { name, joinDate: '2026-01-05', monthlySalaryPaise: 5_000_000 })).json(), personRowSchema);
const createProject = async (name: string) =>
  unwrap(await (await send('POST', '/projects', { name, projectType: 'product', billingType: 'retainer' })).json(), createdSchema).id;

const entriesOf = async (personId: number) =>
  unwrap(await (await send('GET', `/allocations?personId=${personId}`)).json(), allocationRowsSchema);

/** The body the entry form sends for a new entry: from the form's own builder, so the service is shown what the page sends. */
const formBody = (personId: number, projectId: number | null, effectiveDate: string, note = '') =>
  toAllocationBody({
    ...toAllocationFormValues(),
    personId: String(personId),
    projectId: projectId === null ? BENCH : String(projectId),
    effectiveDate,
    note,
  });

describe.skipIf(!base)('the running core service, allocations', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('creates, backfills, lists newest first, refuses a second entry for a date, edits, moves to the bench, and deletes', async () => {
    const person = await createPerson('Allocation check');
    const apollo = await createProject('Allocation Apollo');
    const borealis = await createProject('Allocation Borealis');
    try {
      expect(await entriesOf(person.id)).toEqual([]);

      // The body is the entry form's own: a project, a date and a note.
      const body = formBody(person.id, apollo, '2026-03-12', 'Starts on the platform team');
      expect(body).toEqual({
        personId: person.id,
        card: 1,
        projectId: apollo,
        removed: false,
        effectiveDate: '2026-03-12',
        note: 'Starts on the platform team',
      });
      const created = await send('POST', '/allocations', body);
      expect(created.status).toBe(201);
      const first = unwrap(await created.json(), allocationRowSchema);
      expect(first).toEqual({
        id: first.id,
        personId: person.id,
        card: 1,
        removed: false,
        projectId: apollo,
        effectiveDate: '2026-03-12',
        note: 'Starts on the platform team',
        person: { id: person.id, name: 'Allocation check' },
        project: { id: apollo, name: 'Allocation Apollo' },
      });

      // A note left out comes back null, which the schema reads as empty, and an empty note goes as null.
      const noNote = await send('POST', '/allocations', formBody(person.id, borealis, '2026-06-01'));
      expect(noNote.status).toBe(201);
      const later = unwrap(await noNote.json(), allocationRowSchema);
      expect(later.note).toBe('');
      expect(later.project).toEqual({ id: borealis, name: 'Allocation Borealis' });

      // A backfilled entry dated before the others goes under them: the list is newest first by date, not by id.
      const backfilled = unwrap(
        await (await send('POST', '/allocations', formBody(person.id, null, '2026-01-05'))).json(),
        allocationRowSchema,
      );
      expect(backfilled).toMatchObject({ projectId: null, project: null, effectiveDate: '2026-01-05' });
      expect((await entriesOf(person.id)).map((row) => [row.id, row.effectiveDate])).toEqual([
        [later.id, '2026-06-01'],
        [first.id, '2026-03-12'],
        [backfilled.id, '2026-01-05'],
      ]);

      // One entry a person a date: a second is a 409 in the service's words, and nothing is added.
      const clash = await send('POST', '/allocations', formBody(person.id, borealis, '2026-03-12'));
      expect(clash.status).toBe(409);
      expect(await clash.json()).toMatchObject({ statusCode: 409, message: DUPLICATE_DATE, data: null });
      expect(await entriesOf(person.id)).toHaveLength(3);

      // The project filter keeps the entries that name it, across people.
      const inApollo = unwrap(await (await send('GET', `/allocations?projectId=${apollo}`)).json(), allocationRowsSchema);
      expect(inApollo.map((row) => row.id)).toEqual([first.id]);

      // The row by id reads like a row of the list.
      expect(unwrap(await (await send('GET', `/allocations/${first.id}`)).json(), allocationRowSchema)).toEqual(first);

      // An edit sends the project, the date and the note, never the person (the hook's own body), and may clear the note.
      const edited = await send('PATCH', `/allocations/${first.id}`, {
        projectId: borealis,
        effectiveDate: '2026-03-13',
        note: null,
      });
      expect(edited.status).toBe(200);
      expect(unwrap(await edited.json(), allocationRowSchema)).toMatchObject({
        id: first.id,
        projectId: borealis,
        project: { id: borealis, name: 'Allocation Borealis' },
        effectiveDate: '2026-03-13',
        note: '',
      });

      // projectId null moves the entry to the bench.
      const benched = await send('PATCH', `/allocations/${first.id}`, {
        projectId: null,
        effectiveDate: '2026-03-13',
        note: null,
      });
      expect(benched.status).toBe(200);
      expect(unwrap(await benched.json(), allocationRowSchema)).toMatchObject({
        id: first.id,
        projectId: null,
        project: null,
        effectiveDate: '2026-03-13',
      });

      // Moving the entry onto another entry's date is the same 409, and the entry stays where it was.
      const moveOnto = await send('PATCH', `/allocations/${first.id}`, {
        projectId: null,
        effectiveDate: '2026-06-01',
        note: null,
      });
      expect(moveOnto.status).toBe(409);
      expect(await moveOnto.json()).toMatchObject({ message: DUPLICATE_DATE });

      // The person of an entry cannot change: a body that names one is refused, which is why the hook leaves it out.
      const withPerson = await send('PATCH', `/allocations/${first.id}`, { personId: person.id, projectId: null });
      expect(withPerson.status).toBe(422);
      expect(await withPerson.json()).toMatchObject({ data: [{ loc: ['body', 'personId'] }] });
      // An explicit null date is refused too.
      const noDate = await send('PATCH', `/allocations/${first.id}`, { effectiveDate: null });
      expect(noDate.status).toBe(422);
      expect(await noDate.json()).toMatchObject({ data: [{ loc: ['body', 'effectiveDate'] }] });

      // Delete: gone from the list and from a read by id; a second delete is a 404, which the page treats as done.
      const deleted = await send('DELETE', `/allocations/${later.id}`);
      expect(deleted.status).toBe(200);
      expect((await entriesOf(person.id)).map((row) => row.id)).toEqual([first.id, backfilled.id]);
      expect((await send('GET', `/allocations/${later.id}`)).status).toBe(404);
      expect((await send('DELETE', `/allocations/${later.id}`)).status).toBe(404);

      // Its date is free again.
      expect((await send('POST', '/allocations', formBody(person.id, apollo, '2026-06-01'))).status).toBe(201);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/projects/${apollo}`);
      await send('DELETE', `/projects/${borealis}`);
    }
  });

  it('upserts a move for a day, so two moves on one day leave one entry, and keeps the entry’s note', async () => {
    const person = await createPerson('Move check');
    const apollo = await createProject('Move Apollo');
    const borealis = await createProject('Move Borealis');
    const today = localToday();
    try {
      // The first move of the day adds the entry.
      // The card is left out here: it is card 1 unless it says otherwise. The board always names it.
      const firstMove = await send('POST', '/allocations/move', { personId: person.id, projectId: apollo, effectiveDate: today });
      expect(firstMove.status).toBe(200);
      const placed = unwrap(await firstMove.json(), allocationRowSchema);
      expect(placed).toMatchObject({ personId: person.id, projectId: apollo, effectiveDate: today, note: '' });

      // The second changes that entry: the same id, the new project, still one entry.
      const secondMove = await send('POST', '/allocations/move', {
        personId: person.id,
        card: 1,
        projectId: borealis,
        effectiveDate: today,
      });
      expect(secondMove.status).toBe(200);
      const replaced = unwrap(await secondMove.json(), allocationRowSchema);
      expect(replaced).toMatchObject({ id: placed.id, projectId: borealis, project: { id: borealis, name: 'Move Borealis' } });
      expect(await entriesOf(person.id)).toHaveLength(1);

      // And a third, to the bench (projectId null), the way a drop on the Bench column saves.
      const toBench = await send('POST', '/allocations/move', {
        personId: person.id,
        card: 1,
        projectId: null,
        effectiveDate: today,
      });
      expect(toBench.status).toBe(200);
      expect(unwrap(await toBench.json(), allocationRowSchema)).toMatchObject({ id: placed.id, projectId: null, project: null });
      expect(await entriesOf(person.id)).toHaveLength(1);

      // A move on another day is another entry, newest first.
      const earlier = '2026-01-06';
      const other = await send('POST', '/allocations/move', {
        personId: person.id,
        card: 1,
        projectId: apollo,
        effectiveDate: earlier,
      });
      expect(other.status).toBe(200);
      expect((await entriesOf(person.id)).map((row) => row.effectiveDate)).toEqual([today, earlier]);

      // The note of an entry written by hand survives a move that day.
      const noted = unwrap(
        await (await send('POST', '/allocations', formBody(person.id, apollo, '2026-02-02', 'Kept'))).json(),
        allocationRowSchema,
      );
      const movedNoted = await send('POST', '/allocations/move', { personId: person.id, projectId: borealis, effectiveDate: '2026-02-02' });
      expect(unwrap(await movedNoted.json(), allocationRowSchema)).toMatchObject({ id: noted.id, projectId: borealis, note: 'Kept' });

      // The body is checked like a create: a project that does not exist, a person that does not, a stray key.
      const noProject = await send('POST', '/allocations/move', { personId: person.id, projectId: 2_000_000_000, effectiveDate: today });
      expect(noProject.status).toBe(409);
      expect(await noProject.json()).toMatchObject({ message: 'Referenced record does not exist' });
      const noPerson = await send('POST', '/allocations/move', { personId: 2_000_000_000, projectId: null, effectiveDate: today });
      expect(noPerson.status).toBe(409);
      const noProjectKey = await send('POST', '/allocations/move', { personId: person.id, effectiveDate: today });
      expect(noProjectKey.status).toBe(422);
      expect(await noProjectKey.json()).toMatchObject({ data: [{ loc: ['body', 'projectId'] }] });
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/projects/${apollo}`);
      await send('DELETE', `/projects/${borealis}`);
    }
  });

  it('keeps the name of a project that was deleted afterwards, so the ledger stays readable', async () => {
    const person = await createPerson('Deleted project check');
    const project = await createProject('Short lived project');
    try {
      const entry = unwrap(
        await (await send('POST', '/allocations', formBody(person.id, project, '2026-03-12'))).json(),
        allocationRowSchema,
      );
      expect((await send('DELETE', `/projects/${project}`)).status).toBe(200);
      const [row] = await entriesOf(person.id);
      expect(row).toEqual({ ...entry, project: { id: project, name: 'Short lived project' } });
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });

  it('refuses what the pages cannot send: a person or project that does not exist, a bad date, an unknown key', async () => {
    const person = await createPerson('Allocation refusals');
    try {
      const noPerson = await send('POST', '/allocations', { personId: 2_000_000_000, projectId: null, effectiveDate: '2026-03-12' });
      expect(noPerson.status).toBe(409);
      expect(await noPerson.json()).toMatchObject({ message: 'Referenced record does not exist' });
      const noProject = await send('POST', '/allocations', { personId: person.id, projectId: 2_000_000_000, effectiveDate: '2026-03-12' });
      expect(noProject.status).toBe(409);
      const badDate = await send('POST', '/allocations', { personId: person.id, projectId: null, effectiveDate: '12/03/2026' });
      expect(badDate.status).toBe(422);
      expect(await badDate.json()).toMatchObject({ data: [{ loc: ['body', 'effectiveDate'] }] });
      const stray = await send('POST', '/allocations', { personId: person.id, projectId: null, effectiveDate: '2026-03-12', percent: 50 });
      expect(stray.status).toBe(422);
      expect(await stray.json()).toMatchObject({ data: [{ loc: ['body', 'percent'] }] });
      const badFilter = await send('GET', '/allocations?personId=0');
      expect(badFilter.status).toBe(422);
      expect(await entriesOf(person.id)).toEqual([]);
      expect((await send('PATCH', '/allocations/2000000000', { projectId: null })).status).toBe(404);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
    }
  });
  it('adds, moves and removes cards: numbering, the guards, and the same rule on both sides', async () => {
    const person = await createPerson('Cards check');
    const apollo = await createProject('Cards Apollo');
    const borealis = await createProject('Cards Borealis');
    const today = localToday();
    const after = '2026-12-01';
    /** The cards of the person on a day by the board's own rule, from what the service lists. */
    const cardsNow = async (day: string) => cardsOf(await entriesOf(person.id), person.id, day).map(({ card }) => card);
    try {
      expect(await cardsNow(today)).toEqual([1]);

      // Card 1 is on the bench from the start, so the only card cannot be removed: the guard speaks first.
      const only = await send('POST', '/allocations/remove', { personId: person.id, card: 1, effectiveDate: today });
      expect(only.status).toBe(409);
      expect(await only.json()).toMatchObject({ message: KEEPS_ONE });

      // The cards endpoint: the project of the card it copies, numbered 2, with one entry; the body is the board's own.
      await send('POST', '/allocations/move', { personId: person.id, card: 1, projectId: apollo, effectiveDate: today });
      const copy = await send('POST', '/allocations/cards', { personId: person.id, projectId: apollo, effectiveDate: today });
      expect(copy.status).toBe(201);
      const second = unwrap(await copy.json(), allocationRowSchema);
      expect(second).toMatchObject({ personId: person.id, card: 2, removed: false, projectId: apollo, effectiveDate: today });
      expect(await cardsNow(today)).toEqual([1, 2]);

      // A copy on the bench has no project; the next number is the next one the person has not had.
      const third = unwrap(
        await (await send('POST', '/allocations/cards', { personId: person.id, projectId: null, effectiveDate: today })).json(),
        allocationRowSchema,
      );
      expect(third).toMatchObject({ card: 3, projectId: null, removed: false });
      expect(await cardsNow(today)).toEqual([1, 2, 3]);

      // Move names the card: card 2 goes to Borealis and card 1 stays where it is.
      const moved = await send('POST', '/allocations/move', { personId: person.id, card: 2, projectId: borealis, effectiveDate: today });
      expect(moved.status).toBe(200);
      expect(unwrap(await moved.json(), allocationRowSchema)).toMatchObject({ id: second.id, card: 2, projectId: borealis });
      const entries = await entriesOf(person.id);
      expect(entries.find((row) => row.card === 1)).toMatchObject({ projectId: apollo });

      // A card that does not exist cannot be moved or removed.
      const moveGhost = await send('POST', '/allocations/move', { personId: person.id, card: 9, projectId: apollo, effectiveDate: today });
      expect(moveGhost.status).toBe(409);
      expect(await moveGhost.json()).toMatchObject({ message: NO_SUCH_CARD });
      const removeGhost = await send('POST', '/allocations/remove', { personId: person.id, card: 9, effectiveDate: today });
      expect(removeGhost.status).toBe(409);
      expect(await removeGhost.json()).toMatchObject({ message: NO_SUCH_CARD });

      // Removing a card writes a removed entry with no project, which the list still shows; the card is gone from that day.
      const removed = await send('POST', '/allocations/remove', { personId: person.id, card: 2, effectiveDate: after });
      expect(removed.status).toBe(200);
      const removal = unwrap(await removed.json(), allocationRowSchema);
      expect(removal).toMatchObject({ card: 2, removed: true, projectId: null, project: null, effectiveDate: after });
      expect(await cardsNow(after)).toEqual([1, 3]);
      expect(await cardsNow(today)).toEqual([1, 2, 3]);

      // The same rule on both sides: the board's own `cardsOf` agrees with the service on which cards exist, and the guard
      // refuses exactly when the board would have fewer than two.
      const removeThird = await send('POST', '/allocations/remove', { personId: person.id, card: 3, effectiveDate: after });
      expect(removeThird.status).toBe(200);
      expect(await cardsNow(after)).toEqual([1]);
      const removeLast = await send('POST', '/allocations/remove', { personId: person.id, card: 1, effectiveDate: after });
      expect(removeLast.status).toBe(409);
      expect(await removeLast.json()).toMatchObject({ message: KEEPS_ONE });

      // The next copy is numbered after the largest number the person has had, removed cards counted: 4, not 2.
      const fourth = unwrap(
        await (await send('POST', '/allocations/cards', { personId: person.id, projectId: apollo, effectiveDate: after })).json(),
        allocationRowSchema,
      );
      expect(fourth.card).toBe(4);

      // A later entry of a removed card puts it back.
      const revived = await send('POST', '/allocations', { personId: person.id, card: 2, projectId: borealis, removed: false, effectiveDate: '2027-01-04', note: null });
      expect(revived.status).toBe(201);
      expect(await cardsNow('2027-01-04')).toEqual([1, 2, 4]);

      // One entry a card a date, but another card may have one the same day.
      const sameDay = await send('POST', '/allocations', { personId: person.id, card: 2, projectId: null, removed: false, effectiveDate: '2027-01-04', note: null });
      expect(sameDay.status).toBe(409);
      expect(await sameDay.json()).toMatchObject({ message: DUPLICATE_DATE });
      const otherCard = await send('POST', '/allocations', { personId: person.id, card: 4, projectId: null, removed: false, effectiveDate: '2027-01-04', note: null });
      expect(otherCard.status).toBe(201);

      // An entry cannot be removed and on a project at once.
      const both = await send('POST', '/allocations', { personId: person.id, card: 1, projectId: apollo, removed: true, effectiveDate: '2027-02-01', note: null });
      expect(both.status).toBe(422);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/projects/${apollo}`);
      await send('DELETE', `/projects/${borealis}`);
    }
  });

  it('edits the removed flag of an entry, and refuses a change of its card or person', async () => {
    const person = await createPerson('Removed flag check');
    const apollo = await createProject('Flag Apollo');
    try {
      await send('POST', '/allocations/move', { personId: person.id, card: 1, projectId: apollo, effectiveDate: '2026-03-12' });
      const copy = unwrap(
        await (await send('POST', '/allocations/cards', { personId: person.id, projectId: apollo, effectiveDate: '2026-03-12' })).json(),
        allocationRowSchema,
      );

      // removed: true clears the project, and a project without removed puts the entry back.
      const gone = await send('PATCH', `/allocations/${copy.id}`, { removed: true });
      expect(gone.status).toBe(200);
      expect(unwrap(await gone.json(), allocationRowSchema)).toMatchObject({ removed: true, projectId: null, project: null });
      const back = await send('PATCH', `/allocations/${copy.id}`, { projectId: apollo });
      expect(back.status).toBe(200);
      expect(unwrap(await back.json(), allocationRowSchema)).toMatchObject({ removed: false, projectId: apollo });
      const benched = await send('PATCH', `/allocations/${copy.id}`, { removed: true });
      expect(benched.status).toBe(200);
      // The way the entry form sends "Card removed" over a project, and a removal made a placement again: both keys.
      const bothKeys = await send('PATCH', `/allocations/${copy.id}`, { projectId: apollo, removed: false, effectiveDate: '2026-03-12', note: null });
      expect(bothKeys.status).toBe(200);
      expect(unwrap(await bothKeys.json(), allocationRowSchema)).toMatchObject({ removed: false, projectId: apollo });
      const asRemoval = await send('PATCH', `/allocations/${copy.id}`, { projectId: null, removed: true, effectiveDate: '2026-03-12', note: null });
      expect(asRemoval.status).toBe(200);
      expect(unwrap(await asRemoval.json(), allocationRowSchema)).toMatchObject({ removed: true, projectId: null });
      // Removed with a project is a 422.
      const contradiction = await send('PATCH', `/allocations/${copy.id}`, { projectId: apollo, removed: true });
      expect(contradiction.status).toBe(422);

      // The card and the person of an entry cannot change.
      const card = await send('PATCH', `/allocations/${copy.id}`, { card: 3 });
      expect(card.status).toBe(422);
      expect(await card.json()).toMatchObject({ data: [{ loc: ['body', 'card'] }] });
      const who = await send('PATCH', `/allocations/${copy.id}`, { personId: person.id });
      expect(who.status).toBe(422);
    } finally {
      expect((await send('DELETE', `/people/${person.id}`)).status).toBe(200);
      await send('DELETE', `/projects/${apollo}`);
    }
  });
});
