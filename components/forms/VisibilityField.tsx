"use client";

import type { Visibility } from "../../features/directory/types";

type VisibilityFieldProps = {
  label: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
};

/** Two visible states keep privacy decisions understandable while preserving stored member-only values until changed. */
export function VisibilityField({ label, value, onChange, disabled = false }: VisibilityFieldProps) {
  const isPublic = value === "public";
  return (
    <label className="visibility-field">
      <span>{label}</span>
      <span className="visibility-toggle-copy">
        <input type="checkbox" role="switch" checked={isPublic} onChange={(event) => onChange(event.target.checked ? "public" : "private")} aria-label={`${label}公开范围`} disabled={disabled} />
        <b>{isPublic ? "公开" : "私密"}</b>
      </span>
    </label>
  );
}
