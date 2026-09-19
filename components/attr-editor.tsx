"use client";

import clsx from "clsx";
import { COLOR_DEFS } from "@/lib/colors";
import type { Kind, Occasion, Season, StyleTag } from "@/lib/types";
import { KINDS, KIND_ONE, OCCASIONS, SEASONS, STYLES } from "@/lib/types";
import { Field, inputCls } from "./ui";

export interface EditableAttrs {
  kind: Kind;
  name: string;
  brand: string;
  price: string; // keep as text in the form
  colors: string[];
  styles: StyleTag[];
  seasons: Season[];
  occasions: Occasion[];
  warmth: number;
  formality: number;
  notes: string;
}

export const DEFAULT_ATTRS: EditableAttrs = {
  kind: "top",
  name: "",
  brand: "",
  price: "",
  colors: ["black"],
  styles: ["minimal"],
  seasons: [...SEASONS],
  occasions: ["casual"],
  warmth: 1,
  formality: 1,
  notes: "",
};

const WARMTH_LABELS = ["Airy", "Light", "Mid", "Cozy"];
const FORMALITY_LABELS = ["Lounge", "Casual", "Smart", "Dressy", "Black tie"];

function TagRow<T extends string>({
  options,
  value,
  onToggle,
  single,
}: {
  options: readonly T[];
  value: T[];
  onToggle: (v: T) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
              active ? "border-ink bg-ink text-card" : "border-line bg-card text-muted hover:border-faint",
            )}
          >
            {single ? KIND_ONE[o as Kind] ?? o : o}
          </button>
        );
      })}
    </div>
  );
}

function Steps({
  labels,
  value,
  onChange,
}: {
  labels: string[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {labels.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(i)}
          className={clsx(
            "flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors",
            value === i ? "border-accent bg-accent text-card" : "border-line bg-card text-muted",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function AttrEditor({
  value,
  onChange,
  compact,
}: {
  value: EditableAttrs;
  onChange: (v: EditableAttrs) => void;
  compact?: boolean;
}) {
  const set = (patch: Partial<EditableAttrs>) => onChange({ ...value, ...patch });
  const toggle = <K extends "styles" | "seasons" | "occasions">(key: K, v: EditableAttrs[K][number]) => {
    const arr = value[key] as string[];
    set({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } as Partial<EditableAttrs>);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className={inputCls} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Silk blouse" />
        </Field>
        <Field label="Brand">
          <input className={inputCls} value={value.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="optional" />
        </Field>
      </div>

      <div>
        <span className="micro mb-1.5 block text-muted">Category</span>
        <TagRow options={KINDS} value={[value.kind]} onToggle={(k) => set({ kind: k })} single />
      </div>

      <div>
        <span className="micro mb-1.5 block text-muted">Colours (tap up to 2)</span>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_DEFS.map((c) => {
            const active = value.colors.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => {
                  if (active) set({ colors: value.colors.filter((x) => x !== c.name) });
                  else set({ colors: [...value.colors, c.name].slice(-2) });
                }}
                className={clsx(
                  "h-7 w-7 rounded-full border-2 transition-transform active:scale-90",
                  active ? "scale-110 border-ink" : "border-ink/10",
                )}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <span className="micro mb-1.5 block text-muted">Style</span>
        <TagRow options={STYLES} value={value.styles} onToggle={(v) => toggle("styles", v)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className="micro mb-1.5 block text-muted">Seasons</span>
          <TagRow options={SEASONS} value={value.seasons} onToggle={(v) => toggle("seasons", v)} />
        </div>
        <div>
          <span className="micro mb-1.5 block text-muted">Occasions</span>
          <TagRow options={OCCASIONS} value={value.occasions} onToggle={(v) => toggle("occasions", v)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className="micro mb-1.5 block text-muted">Warmth</span>
          <Steps labels={WARMTH_LABELS} value={value.warmth} onChange={(n) => set({ warmth: n })} />
        </div>
        <div>
          <span className="micro mb-1.5 block text-muted">Formality</span>
          <Steps labels={FORMALITY_LABELS} value={value.formality} onChange={(n) => set({ formality: n })} />
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (€)">
            <input
              className={inputCls}
              inputMode="decimal"
              value={value.price}
              onChange={(e) => set({ price: e.target.value })}
              placeholder="e.g. 120"
            />
          </Field>
          <Field label="Notes">
            <input className={inputCls} value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="dry clean only…" />
          </Field>
        </div>
      )}
    </div>
  );
}
