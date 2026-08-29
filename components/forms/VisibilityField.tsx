"use client";

import type { Visibility } from "../../features/directory/types";

export const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "public", label: "所有访客可见" },
  { value: "members", label: "仅审核成员可见" },
  { value: "private", label: "仅自己和必要管理员可见" },
];

type VisibilityFieldProps = {
  label: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
};

/** A compact, keyboard-friendly privacy control used for every optional profile field. */
export function VisibilityField({ label, value, onChange, disabled = false }: VisibilityFieldProps) {
  return (
    <label className="visibility-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Visibility)} aria-label={`${label}公开范围`} disabled={disabled}>
        {VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
