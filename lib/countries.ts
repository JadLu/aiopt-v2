// Country data for target markets. No Firebase / React imports: safe on both sides.
// Source: docs/redesign/mockups/NewProject.dc.html (script block).

export interface Country {
  code: string; // ISO 3166-1 alpha-2 (XK = Kosovo, user-assigned)
  name: string;
}

export interface CountryGroup {
  id: string;
  name: string;
  /** Arabic dialect / language note, e.g. "Khaleeji Arabic" (MENA groups). */
  dialect?: string;
  countries: Country[];
}

export interface Region {
  id: string;
  name: string;
  groups: CountryGroup[];
}

const c = (code: string, name: string): Country => ({ code, name });

export const REGIONS: Region[] = [
  {
    id: "mena", name: "MENA", groups: [
      { id: "gulf", name: "Gulf & Peninsula", dialect: "Khaleeji Arabic", countries: [c("SA", "Saudi Arabia"), c("AE", "UAE"), c("KW", "Kuwait"), c("QA", "Qatar"), c("BH", "Bahrain"), c("OM", "Oman"), c("YE", "Yemen")] },
      { id: "levant", name: "Levant & Iraq", dialect: "Shami · Iraqi Arabic", countries: [c("JO", "Jordan"), c("LB", "Lebanon"), c("PS", "Palestine"), c("SY", "Syria"), c("IQ", "Iraq")] },
      { id: "nile", name: "Nile Valley", dialect: "Egyptian · Sudanese Arabic", countries: [c("EG", "Egypt"), c("SD", "Sudan")] },
      { id: "maghreb", name: "Maghreb", dialect: "Maghrebi Arabic · Darija", countries: [c("MA", "Morocco"), c("DZ", "Algeria"), c("TN", "Tunisia"), c("LY", "Libya"), c("MR", "Mauritania")] },
      { id: "mena-rest", name: "Rest of the region", dialect: "Turkish · Persian · Hebrew", countries: [c("TR", "Türkiye"), c("IR", "Iran"), c("IL", "Israel")] },
    ],
  },
  {
    id: "eu", name: "Europe", groups: [
      { id: "eu-west", name: "Western Europe", countries: [c("GB", "United Kingdom"), c("FR", "France"), c("DE", "Germany"), c("NL", "Netherlands"), c("BE", "Belgium"), c("CH", "Switzerland"), c("AT", "Austria"), c("IE", "Ireland"), c("LU", "Luxembourg"), c("LI", "Liechtenstein"), c("MC", "Monaco")] },
      { id: "eu-north", name: "Northern Europe", countries: [c("SE", "Sweden"), c("NO", "Norway"), c("DK", "Denmark"), c("FI", "Finland"), c("IS", "Iceland"), c("EE", "Estonia"), c("LV", "Latvia"), c("LT", "Lithuania")] },
      { id: "eu-south", name: "Southern Europe", countries: [c("ES", "Spain"), c("IT", "Italy"), c("PT", "Portugal"), c("GR", "Greece"), c("CY", "Cyprus"), c("MT", "Malta"), c("HR", "Croatia"), c("SI", "Slovenia"), c("RS", "Serbia"), c("BA", "Bosnia & Herzegovina"), c("ME", "Montenegro"), c("MK", "North Macedonia"), c("AL", "Albania"), c("XK", "Kosovo"), c("AD", "Andorra"), c("SM", "San Marino"), c("VA", "Vatican City")] },
      { id: "eu-east", name: "Eastern Europe", countries: [c("PL", "Poland"), c("CZ", "Czechia"), c("SK", "Slovakia"), c("HU", "Hungary"), c("RO", "Romania"), c("BG", "Bulgaria"), c("UA", "Ukraine"), c("MD", "Moldova"), c("BY", "Belarus"), c("RU", "Russia")] },
    ],
  },
  {
    id: "am", name: "Americas", groups: [
      { id: "am-north", name: "North America", countries: [c("US", "United States"), c("CA", "Canada"), c("MX", "Mexico")] },
      { id: "am-central", name: "Central America & Caribbean", countries: [c("GT", "Guatemala"), c("BZ", "Belize"), c("HN", "Honduras"), c("SV", "El Salvador"), c("NI", "Nicaragua"), c("CR", "Costa Rica"), c("PA", "Panama"), c("CU", "Cuba"), c("DO", "Dominican Republic"), c("HT", "Haiti"), c("JM", "Jamaica"), c("BS", "Bahamas"), c("BB", "Barbados"), c("TT", "Trinidad & Tobago"), c("AG", "Antigua & Barbuda"), c("DM", "Dominica"), c("GD", "Grenada"), c("KN", "Saint Kitts & Nevis"), c("LC", "Saint Lucia"), c("VC", "Saint Vincent & the Grenadines")] },
      { id: "am-south", name: "South America", countries: [c("BR", "Brazil"), c("AR", "Argentina"), c("CO", "Colombia"), c("CL", "Chile"), c("PE", "Peru"), c("VE", "Venezuela"), c("EC", "Ecuador"), c("BO", "Bolivia"), c("PY", "Paraguay"), c("UY", "Uruguay"), c("GY", "Guyana"), c("SR", "Suriname")] },
    ],
  },
  {
    id: "af", name: "Africa", groups: [
      { id: "af-west", name: "West Africa", countries: [c("NG", "Nigeria"), c("GH", "Ghana"), c("CI", "Côte d’Ivoire"), c("SN", "Senegal"), c("ML", "Mali"), c("BF", "Burkina Faso"), c("NE", "Niger"), c("GN", "Guinea"), c("BJ", "Benin"), c("TG", "Togo"), c("SL", "Sierra Leone"), c("LR", "Liberia"), c("GM", "Gambia"), c("GW", "Guinea-Bissau"), c("CV", "Cabo Verde")] },
      { id: "af-east", name: "East Africa", countries: [c("KE", "Kenya"), c("ET", "Ethiopia"), c("TZ", "Tanzania"), c("UG", "Uganda"), c("RW", "Rwanda"), c("BI", "Burundi"), c("SO", "Somalia"), c("DJ", "Djibouti"), c("ER", "Eritrea"), c("SS", "South Sudan"), c("KM", "Comoros"), c("MG", "Madagascar"), c("MU", "Mauritius"), c("SC", "Seychelles"), c("MW", "Malawi"), c("MZ", "Mozambique"), c("ZM", "Zambia"), c("ZW", "Zimbabwe")] },
      { id: "af-central", name: "Central Africa", countries: [c("CD", "DR Congo"), c("CG", "Congo"), c("CM", "Cameroon"), c("AO", "Angola"), c("GA", "Gabon"), c("TD", "Chad"), c("CF", "Central African Republic"), c("GQ", "Equatorial Guinea"), c("ST", "São Tomé & Príncipe")] },
      { id: "af-south", name: "Southern Africa", countries: [c("ZA", "South Africa"), c("NA", "Namibia"), c("BW", "Botswana"), c("LS", "Lesotho"), c("SZ", "Eswatini")] },
    ],
  },
  {
    id: "as", name: "Asia", groups: [
      { id: "as-south", name: "South Asia", countries: [c("IN", "India"), c("PK", "Pakistan"), c("BD", "Bangladesh"), c("LK", "Sri Lanka"), c("NP", "Nepal"), c("BT", "Bhutan"), c("MV", "Maldives"), c("AF", "Afghanistan")] },
      { id: "as-southeast", name: "Southeast Asia", countries: [c("ID", "Indonesia"), c("MY", "Malaysia"), c("SG", "Singapore"), c("TH", "Thailand"), c("VN", "Vietnam"), c("PH", "Philippines"), c("MM", "Myanmar"), c("KH", "Cambodia"), c("LA", "Laos"), c("BN", "Brunei"), c("TL", "Timor-Leste")] },
      { id: "as-east", name: "East Asia", countries: [c("CN", "China"), c("JP", "Japan"), c("KR", "South Korea"), c("TW", "Taiwan"), c("MN", "Mongolia"), c("KP", "North Korea")] },
      { id: "as-central", name: "Central Asia & Caucasus", countries: [c("KZ", "Kazakhstan"), c("UZ", "Uzbekistan"), c("KG", "Kyrgyzstan"), c("TJ", "Tajikistan"), c("TM", "Turkmenistan"), c("AZ", "Azerbaijan"), c("GE", "Georgia"), c("AM", "Armenia")] },
    ],
  },
  {
    id: "oc", name: "Oceania", groups: [
      { id: "oc-all", name: "Oceania", countries: [c("AU", "Australia"), c("NZ", "New Zealand"), c("PG", "Papua New Guinea"), c("FJ", "Fiji"), c("SB", "Solomon Islands"), c("VU", "Vanuatu"), c("WS", "Samoa"), c("TO", "Tonga"), c("KI", "Kiribati"), c("FM", "Micronesia"), c("MH", "Marshall Islands"), c("PW", "Palau"), c("NR", "Nauru"), c("TV", "Tuvalu")] },
    ],
  },
];

export const COUNTRY_BY_CODE: Record<string, Country> = {};
const CODE_BY_NAME: Record<string, string> = {};
for (const r of REGIONS) {
  for (const g of r.groups) {
    for (const ct of g.countries) {
      COUNTRY_BY_CODE[ct.code] = ct;
      CODE_BY_NAME[ct.name.toLowerCase()] = ct.code;
    }
  }
}

// Legacy / alternate spellings found in older projects or mock data.
const ALIASES: Record<string, string> = {
  "united arab emirates": "AE", uae: "AE",
  ksa: "SA", "kingdom of saudi arabia": "SA",
  egy: "EG", mar: "MA", usa: "US", "united states of america": "US", uk: "GB",
  turkey: "TR", turkiye: "TR", "czech republic": "CZ", "ivory coast": "CI",
  "democratic republic of the congo": "CD", "republic of the congo": "CG",
};

/** Resolve a country name (any case, common aliases) to its ISO code. */
export function findCountryCode(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return CODE_BY_NAME[key] ?? ALIASES[key];
}

export function countryName(code: string): string {
  return COUNTRY_BY_CODE[code]?.name ?? code;
}

/**
 * ISO codes for a project. New projects store `countries`; older ones only have a
 * free-text `country` ("Libya" or "Libya, Egypt"), which is resolved by name.
 */
export function projectCountryCodes(project: { countries?: string[]; country: string }): string[] {
  if (project.countries && project.countries.length > 0) {
    return project.countries.filter((code) => code in COUNTRY_BY_CODE);
  }
  const codes: string[] = [];
  for (const part of (project.country ?? "").split(/[,;/&]|\band\b/i)) {
    const code = findCountryCode(part);
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** Full names joined for storage / AI prompts, e.g. "Libya, Egypt". */
export function joinCountryNames(codes: string[]): string {
  return codes.map(countryName).join(", ");
}

/** Short label for cards, e.g. "Libya, Egypt +1". Falls back to the raw text for unresolved legacy values. */
export function marketsLabel(project: { countries?: string[]; country: string }, max = 2): string {
  const codes = projectCountryCodes(project);
  if (codes.length === 0) return project.country;
  const shown = codes.slice(0, max).map(countryName).join(", ");
  return codes.length > max ? `${shown} +${codes.length - max}` : shown;
}

export interface CountrySearchGroup {
  id: string;
  label: string; // "Region · Group" (just the name when they match)
  dialect?: string;
  countries: Country[];
}

/** Search every region by name (substring) or exact ISO code. Empty groups are dropped. */
export function searchCountries(query: string): CountrySearchGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: CountrySearchGroup[] = [];
  for (const r of REGIONS) {
    for (const g of r.groups) {
      const countries = g.countries.filter(
        (ct) => ct.name.toLowerCase().includes(q) || ct.code.toLowerCase() === q
      );
      if (countries.length > 0) {
        out.push({
          id: g.id,
          label: g.name === r.name ? r.name : `${r.name} · ${g.name}`,
          dialect: g.dialect,
          countries,
        });
      }
    }
  }
  return out;
}

// ── Voice / dialect ───────────────────────────────────────────────────────

/** Spoken / written voice to use for a market, when we have a specific one. */
const VOICE_BY_CODE: Record<string, string> = {
  SA: "Khaleeji Arabic", AE: "Khaleeji Arabic", KW: "Khaleeji Arabic", QA: "Khaleeji Arabic",
  BH: "Khaleeji Arabic", OM: "Khaleeji Arabic", YE: "Yemeni Arabic",
  JO: "Shami Arabic", LB: "Shami Arabic", PS: "Shami Arabic", SY: "Shami Arabic", IQ: "Iraqi Arabic",
  EG: "Egyptian Arabic", SD: "Sudanese Arabic",
  MA: "Moroccan Darija", DZ: "Algerian Darija", TN: "Tunisian Arabic", LY: "Libyan Arabic", MR: "Hassaniya Arabic",
  TR: "Turkish", IR: "Persian", IL: "Hebrew",
};

/** Distinct voices for a project's markets, e.g. ["Libyan Arabic"]. Empty when none is known. */
export function projectVoices(project: { countries?: string[]; country: string }): string[] {
  const out: string[] = [];
  for (const code of projectCountryCodes(project)) {
    const voice = VOICE_BY_CODE[code];
    if (voice && !out.includes(voice)) out.push(voice);
  }
  return out;
}

/** "Libyan Arabic voice" / "Khaleeji Arabic · Egyptian Arabic +1 voices". Empty string when unknown. */
export function voiceLabel(project: { countries?: string[]; country: string }, max = 2): string {
  const voices = projectVoices(project);
  if (voices.length === 0) return "";
  if (voices.length === 1) return `${voices[0]} voice`;
  const shown = voices.slice(0, max).join(" · ");
  return voices.length > max ? `${shown} +${voices.length - max} voices` : `${shown} voices`;
}
