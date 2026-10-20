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
 * The service's `totals` for a quote, by the design's formulas, on integers: hours in hundredths, percents in hundredths
 * of a percent, costs in cents, every division half up. Written out here on plain numbers (the quotes in these specs are
 * small, so they are exact) and not taken from the app, so a spec that compares the two checks the app's calculation.
 */
function totalsOf(quote: Row): Row {
  const lines = quote.lines as { units: number; hoursPerUnit: number }[];
  const count = (key: string) => quote[key] as number;
  const hundredths = (value: number) => Math.round(value * 100);

  const base = lines.reduce((sum, line) => sum + line.units * hundredths(line.hoursPerUnit), 0);
  const testing = halfUp(base * hundredths(count('testingPercent')), 10_000);
  const bugFix = halfUp(base * hundredths(count('bugFixPercent')), 10_000);
  const development = base + bugFix;
  const build = base + testing + bugFix;
  const management = halfUp(build * hundredths(count('managementPercent')), 10_000);
  const total = build + management;

  const developmentCost = halfUp(development * count('developerRateCents'), 100);
  const managementCost = halfUp(management * count('managerRateCents'), 100);
  const testingCost = halfUp(testing * count('testerRateCents'), 100);
  const subtotal = developmentCost + managementCost + testingCost;
  const negotiationBuffer = halfUp(subtotal * hundredths(count('negotiationBufferPercent')), 10_000);

  // Hours, person-days and months are decimal numbers on the wire (1188, 2.48), costs whole minor units.
  return {
    baseHours: base / 100,
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
    finalQuoteCents: subtotal + negotiationBuffer,
  };
}

/**
 * A quote as the service answers it: the lines get ids (each keeps the title and description it was sent with), and the
 * totals are worked out from what is stored.
 */
function stored(id: number, fields: Row): Row {
  const lines = (fields.lines as Row[]).map((line, index) => ({ id: id * 100 + index + 1, ...line }));
  const quote = { ...fields, lines };
  return record({ id, ...quote, totals: totalsOf(quote) });
}

/** The id of the first quote the stub creates, so a spec can tell the address came from the answer. */
export const FIRST_QUOTE_ID = 12;

/**
 * Everything `stubApi` stubs, plus the quotation routes. They start empty and keep state: a quote the page creates is
 * answered with the id 12 (then 13, ...), shows up on the next read of the list and of its own address, and an edit
 * replaces its lines and settings and works its totals out again, as the service does.
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
    // Totals are never stored: they are worked out again from what the edit leaves. A PATCH without `lines` keeps the old ones.
    const { totals, ...kept } = existing;
    void totals;
    const edited = stored(id, { ...kept, ...(body as Row) });
    quotes = quotes.map((row) => (row.id === id ? edited : row));
    return { body: envelope(edited) };
  });
}
