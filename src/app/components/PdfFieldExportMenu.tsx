"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

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
  }, [storageKey]);

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
    await onExport(selectedKeys);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <FileDown className="mr-2 size-4" />
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {menuLabel}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({selectedCount}/{allCount})
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={selectAllState}
          onCheckedChange={toggleAll}
        >
          Select all
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {fields.map((f) => (
          <DropdownMenuCheckboxItem
            key={f.key}
            checked={Boolean(selected[f.key])}
            onCheckedChange={(next) => toggleOne(f.key, next as CheckedState)}
          >
            {f.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled || selectedKeys.length === 0}
          onSelect={() => void handleExport()}
        >
          <FileDown className="mr-2 size-4" />
          {exportLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
