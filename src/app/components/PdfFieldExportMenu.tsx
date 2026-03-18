"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, ListChecks, RotateCcw, X } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

type CheckedState = boolean | "indeterminate";

export type PdfFieldOption = {
  key: string;
  label: string;
};

export function PdfFieldExportMenu({
  disabled,
  fields,
  storageKey,
  buttonLabel = "Export PDF",
  menuLabel = "Choose fields",
  exportLabel = "Download PDF",
  onExport,
}: {
  disabled?: boolean;
  fields: PdfFieldOption[];
  storageKey: string;
  buttonLabel?: string;
  menuLabel?: string;
  exportLabel?: string;
  onExport: (selectedKeys: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const f of fields) initial[f.key] = true;
    return initial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next: Record<string, boolean> = {};
      for (const f of fields) next[f.key] = parsed.includes(f.key);
      setSelected(next);
    } catch {
      // ignore
    }
  }, [fields, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const selectedKeys = Object.entries(selected)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k);
      window.localStorage.setItem(storageKey, JSON.stringify(selectedKeys));
    } catch {
      // ignore
    }
  }, [selected, storageKey]);

  const selectedKeys = useMemo(
    () =>
      fields
        .map((f) => f.key)
        .filter((key) => Boolean(selected[key])),
    [fields, selected],
  );

  const selectedCount = selectedKeys.length;
  const allCount = fields.length;

  const selectAllState: CheckedState =
    selectedCount === 0
      ? false
      : selectedCount === allCount
        ? true
        : "indeterminate";

  const toggleAll = (next: CheckedState) => {
    const shouldSelect = next === true;
    const updated: Record<string, boolean> = {};
    for (const f of fields) updated[f.key] = shouldSelect;
    setSelected(updated);
  };

  const toggleOne = (key: string, next: CheckedState) => {
    setSelected((prev) => ({ ...prev, [key]: next === true }));
  };

  const handleExport = async () => {
    if (disabled) return;
    if (selectedKeys.length === 0) return;
    setOpen(false);
    await onExport(selectedKeys);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <FileDown className="mr-2 size-4" />
          {buttonLabel}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{menuLabel}</p>
            <p className="text-xs text-muted-foreground">
              {selectedCount}/{allCount} selected
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleAll(true)}
              title="Select all"
            >
              <ListChecks className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleAll(false)}
              title="Clear selection"
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
              title="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-auto px-3 py-2">
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              checked={selectAllState}
              onCheckedChange={(next) => toggleAll(next as CheckedState)}
            />
            <span className="text-sm">Select all</span>
          </div>
          <div className="my-2 h-px bg-border/70" />
          <div className="space-y-1">
            {fields.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleOne(f.key, !selected[f.key])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Checkbox
                  checked={Boolean(selected[f.key])}
                  onCheckedChange={(next) =>
                    toggleOne(f.key, next as CheckedState)
                  }
                  onClick={(event) => event.stopPropagation()}
                />
                <span className="flex-1">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleExport()}
            disabled={disabled || selectedKeys.length === 0}
          >
            <FileDown className="mr-2 size-4" />
            {exportLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
