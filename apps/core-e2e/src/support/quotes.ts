import { CORE_API, stubApi } from './api';

type Row = Record<string, unknown>;

const stamp = '2026-10-20T09:30:00.000000Z';

/** A row as the core service sends it: the audit fields come with every record. */
const record = (fields: Row): Row => ({ status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null, ...fields });

/** The core service wraps every answer in this envelope. */
const envelope = (data: unknown, statusCode = 200) => ({ statusCode, message: 'ok', data, meta: null });

/** A credentialed cross-origin answer must name the page's own origin and allow credentials. */
const corsHeaders = (origin: unknown) => ({
  'access-control-allow-origin': typeof origin === 'string' ? origin : 'http://localhost:3000',
  'access-control-allow-credentials': 'true',
});

function stubCore(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  answer: (request: { url: string; body: unknown }) => { statusCode?: number; body: unknown },
) {
  // XHRs only: the dev server can land on a port the app's own pages share with an API route.
  cy.intercept({ method, url: `${CORE_API}${path}`, resourceType: 'xhr' }, (req) => {
    const { statusCode = 200, body } = answer({ url: req.url, body: req.body });
    // `body`: an object that holds `statusCode` would otherwise be read by Cypress as the response itself.
    req.reply({ statusCode, body, headers: corsHeaders(req.headers.origin) });
  });
}

/** `n / d` with halves going up, for a non-negative `n` and a positive `d`. */
const halfUp = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));

/**
 * The service's `totals` for a quote, by the design's formulas (section 8.3), on integers: hours in hundredths, percents in
 * hundredths of a percent, costs in cents, every division half up but the discount's, which is floored. Written out here on
 * plain numbers (the quotes in these specs are small, so they are exact) and not taken from the app, so a spec that compares
 * the two checks the app's calculation.
 */
function totalsOf(quote: Row): Row {
  // The lines of every section: sections only group them.
  const lines = (quote.sections as { lines: { units: number; hoursPerUnit: number }[] }[]).flatMap(
    (section) => section.lines,
  );
  const count = (key: string) => quote[key] as number;
  // The time buffer and the discount are 0 for a quote saved without them, as they are in the service.
  const percent = (key: string) => (quote[key] as number | undefined) ?? 0;
  const hundredths = (value: number) => Math.round(value * 100);

  // Each line is padded by the time buffer on its own, a half going up; everything after starts from the padded sum.
  const raw = lines.map((line) => line.units * hundredths(line.hoursPerUnit));
  const base = raw.reduce((sum, hours) => sum + hours, 0);
  const timeBuffer = hundredths(percent('timeBufferPercent'));
  const buffered = raw.reduce((sum, hours) => sum + hours + halfUp(hours * timeBuffer, 10_000), 0);
  const testing = halfUp(buffered * hundredths(count('testingPercent')), 10_000);
  const bugFix = halfUp(buffered * hundredths(count('bugFixPercent')), 10_000);
  const development = buffered + bugFix;
  const build = buffered + testing + bugFix;
  const management = halfUp(build * hundredths(count('managementPercent')), 10_000);
  const total = build + management;

  const developmentCost = halfUp(development * count('developerRateCents'), 100);
  const managementCost = halfUp(management * count('managerRateCents'), 100);
  const testingCost = halfUp(testing * count('testerRateCents'), 100);
  const subtotal = developmentCost + managementCost + testingCost;
  const negotiationBuffer = halfUp(subtotal * hundredths(count('negotiationBufferPercent')), 10_000);
  // The discount comes off the subtotal and the negotiation buffer together, floored: no part of a cent is taken off.
  const beforeDiscount = subtotal + negotiationBuffer;
  const discount = Math.floor((beforeDiscount * hundredths(percent('discountPercent'))) / 10_000);

  // Hours, person-days and months are decimal numbers on the wire (1188, 2.48), costs whole minor units.
  return {
    baseHours: base / 100,
    timeBufferHours: (buffered - base) / 100,
    bufferedBaseHours: buffered / 100,
    testingHours: testing / 100,
    bugFixHours: bugFix / 100,
    developmentHours: development / 100,
    buildHours: build / 100,
    managementHours: management / 100,
    totalHours: total / 100,
    developmentHoursPerPerson: halfUp(development, count('developerCount')) / 100,
    managementHoursPerPerson: halfUp(management, count('managerCount')) / 100,
    testingHoursPerPerson: halfUp(testing, count('testerCount')) / 100,
    personDays: halfUp(total, count('hoursPerDay')) / 100,
    elapsedMonths: halfUp(build, count('developerCount') * count('hoursPerMonth')) / 100,
    developmentCostCents: developmentCost,
    managementCostCents: managementCost,
    testingCostCents: testingCost,
    subtotalCents: subtotal,
    negotiationBufferCents: negotiationBuffer,
    discountCents: discount,
    finalQuoteCents: beforeDiscount - discount,
  };
}

/**
 * A quote as the service answers it: the sections and their lines get ids, ascending in the order written (each keeps the
 * title it was sent with, and each line its description, empty text when it was sent without one), and the totals are
 * worked out from what is stored.
 */
function stored(id: number, fields: Row): Row {
  let lineId = id * 1000;
  const sections = (fields.sections as Row[]).map((section, sectionIndex) => ({
    id: id * 100 + sectionIndex + 1,
    title: section.title,
    lines: (section.lines as Row[]).map((line) => {
      lineId += 1;
      return { id: lineId, description: '', ...line };
    }),
  }));
  // A body without the time buffer or the discount is stored with 0, which is what the service's defaults are.
  const quote = { timeBufferPercent: 0, discountPercent: 0, ...fields, sections };
  return record({ id, ...quote, totals: totalsOf(quote) });
}

/** The id of the first quote the stub creates, so a spec can tell the address came from the answer. */
export const FIRST_QUOTE_ID = 12;

/**
 * Everything `stubApi` stubs, plus the quotation routes. They start empty and keep state: a quote the page creates is
 * answered with the id 12 (then 13, ...), shows up on the next read of the list and of its own address, and an edit
 * replaces its sections, their lines and its settings and works its totals out again, as the service does.
 */
export function stubQuotes() {
  stubApi();
  let quotes: Row[] = [];
  let nextId = FIRST_QUOTE_ID;

  const idOf = (url: string) => Number(url.split('/').pop());
  const notFound = () => ({ statusCode: 404, body: envelope(null, 404) });

  stubCore('GET', '/quotations', () => ({ body: envelope(quotes) }));
  // `*` does not cross a `/`, hence one stub for the collection and one for a quote.
  stubCore('GET', '/quotations/*', ({ url }) => {
    const quote = quotes.find((row) => row.id === idOf(url));
    return quote ? { body: envelope(quote) } : notFound();
  });
  stubCore('POST', '/quotations', ({ body }) => {
    const created = stored(nextId, body as Row);
    nextId += 1;
    quotes = [...quotes, created];
    return { statusCode: 201, body: envelope(created, 201) };
  });
  stubCore('PATCH', '/quotations/*', ({ url, body }) => {
    const id = idOf(url);
    const existing = quotes.find((row) => row.id === id);
    if (!existing) return notFound();
    // Totals are never stored: they are worked out again from what the edit leaves. A PATCH without `sections` keeps the old
    // ones (as the service would, with their ids: here they are numbered again, which no spec reads).
    const { totals, ...kept } = existing;
    void totals;
    const edited = stored(id, { ...kept, ...(body as Row) });
    quotes = quotes.map((row) => (row.id === id ? edited : row));
    return { body: envelope(edited) };
  });
}
