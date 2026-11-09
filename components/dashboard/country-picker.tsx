"use client";

import { useState } from "react";
import { Search, Check } from "lucide-react";
import { REGIONS, countryName, searchCountries, type Country } from "@/lib/countries";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Chip } from "@/components/ui/chip";

interface CountryPickerProps {
  /** Selected ISO codes, in the order they were picked. */
  value: string[];
  onChange: (codes: string[]) => void;
  /** Shown under the count when no market is selected and the user tried to submit. */
  error?: string | null;
}

export function CountryPicker({ value, onChange, error }: CountryPickerProps) {
  const [region, setRegion] = useState(REGIONS[0].id);
  const [query, setQuery] = useState("");

  const selected = new Set(value);
  const searching = query.trim().length > 0;

  function toggle(code: string) {
    onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  }

  const groups = searching
    ? searchCountries(query)
    : (REGIONS.find((r) => r.id === region) ?? REGIONS[0]).groups.map((g) => ({
        id: g.id, label: g.name, dialect: g.dialect, countries: g.countries,
      }));

  const tabs = REGIONS.map((r) => ({
    value: r.id,
    label: r.name,
    count: r.groups.reduce((n, g) => n + g.countries.filter((ct) => selected.has(ct.code)).length, 0),
  }));

  const countText =
    value.length === 0 ? "Pick at least one market"
    : value.length === 1 ? "1 market selected"
    : `${value.length} markets selected`;

  function renderCountry(ct: Country) {
    const on = selected.has(ct.code);
    return (
      <button key={ct.code} type="button" className="country-chip" aria-pressed={on} onClick={() => toggle(ct.code)}>
        <span className="country-code" aria-hidden>{on ? <Check size={13} strokeWidth={3} /> : ct.code}</span>
        {ct.name}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="field-label">Target markets</span>
          <span
            className="tabular"
            aria-live="polite"
            style={{ fontSize: 13, fontWeight: 600, color: error ? "var(--danger)" : "var(--accent-primary)" }}
          >
            {error ?? countText}
          </span>
        </div>
        <label className="input-well" style={{ display: "flex", alignItems: "center", gap: 8, width: 240, maxWidth: "100%", minHeight: 40, padding: "0 12px", color: "var(--text-secondary)" }}>
          <Search size={15} strokeWidth={2} aria-hidden />
          <input
            type="search"
            aria-label="Search all countries"
            placeholder="Search all countries"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: "var(--text-primary)", font: "inherit", fontSize: 13.5 }}
          />
        </label>
      </div>

      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {value.map((code) => (
            <Chip key={code} onRemove={() => toggle(code)} removeLabel={`Remove ${countryName(code)}`} className="chip-sm">
              {countryName(code)}
            </Chip>
          ))}
          <button type="button" className="sidebar-link" style={{ padding: "6px 8px" }} onClick={() => onChange([])}>
            Clear all
          </button>
        </div>
      )}

      {!searching && (
        <SegmentedControl
          ariaLabel="Regions"
          value={region}
          onChange={setRegion}
          options={tabs}
          badge
        />
      )}

      <div style={{ maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {groups.map((g) => (
          <div key={g.id} className="glass-inner country-group">
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.label}</span>
              {g.dialect && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{g.dialect}</span>}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.countries.map(renderCountry)}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 2px" }}>
            No country matches that search.
          </span>
        )}
      </div>
    </div>
  );
}
