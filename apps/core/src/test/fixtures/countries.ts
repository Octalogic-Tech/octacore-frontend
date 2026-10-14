// Twelve real rows from GET http://localhost:5001/api/v1/countries (octacore-backend, FastAPI),
// captured 2026-10-14, in the service's own envelope. Antarctica and Bouvet Island carry the 0 that
// the data uses for "no numeric code" and "no calling code".
export const countryRows = [
  { id: 1, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "AF", name: "AFGHANISTAN", nicename: "Afghanistan", iso3: "AFG", numcode: 4, phonecode: 93 },
  { id: 2, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "AL", name: "ALBANIA", nicename: "Albania", iso3: "ALB", numcode: 8, phonecode: 355 },
  { id: 3, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "DZ", name: "ALGERIA", nicename: "Algeria", iso3: "DZA", numcode: 12, phonecode: 213 },
  { id: 8, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "AQ", name: "ANTARCTICA", nicename: "Antarctica", iso3: "NULL", numcode: 0, phonecode: 0 },
  { id: 29, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "BV", name: "BOUVET ISLAND", nicename: "Bouvet Island", iso3: "NULL", numcode: 0, phonecode: 0 },
  { id: 30, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "BR", name: "BRAZIL", nicename: "Brazil", iso3: "BRA", numcode: 76, phonecode: 55 },
  { id: 73, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "FR", name: "FRANCE", nicename: "France", iso3: "FRA", numcode: 250, phonecode: 33 },
  { id: 80, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "DE", name: "GERMANY", nicename: "Germany", iso3: "DEU", numcode: 276, phonecode: 49 },
  { id: 99, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "IN", name: "INDIA", nicename: "India", iso3: "IND", numcode: 356, phonecode: 91 },
  { id: 107, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "JP", name: "JAPAN", nicename: "Japan", iso3: "JPN", numcode: 392, phonecode: 81 },
  { id: 225, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "GB", name: "UNITED KINGDOM", nicename: "United Kingdom", iso3: "GBR", numcode: 826, phonecode: 44 },
  { id: 226, status: 1, createdDate: "2026-10-14T14:41:42.928081Z", updatedDate: "2026-10-14T14:41:42.928081Z", deletedDate: null, iso: "US", name: "UNITED STATES", nicename: "United States", iso3: "USA", numcode: 840, phonecode: 1 },
];

export const countriesEnvelope = (data: unknown = countryRows) => ({
  statusCode: 200,
  message: 'Successfully fetched countries',
  data,
  meta: null,
});
