"use client";

import React from "react"

import { useRef, useCallback } from "react";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  label: string;
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  label,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lines = value ? value.split("\n") : [""];
  const lineNumbers = lines.map((_, i) => i + 1);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue =
          value.substring(0, start) + "  " + value.substring(end);
        onChange?.(newValue);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange]
  );

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const lineNumberEl = textarea?.parentElement?.querySelector(
      "[data-line-numbers]"
    ) as HTMLElement;
    if (textarea && lineNumberEl) {
      lineNumberEl.scrollTop = textarea.scrollTop;
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {!readOnly && (
          <span className="text-xs text-muted-foreground/60">
            Paste Lua code here
          </span>
        )}
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          data-line-numbers
          className="flex-shrink-0 w-12 overflow-hidden bg-editor py-3 text-right select-none"
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div
              key={num}
              className="px-2 text-xs leading-5 text-muted-foreground/40 font-mono"
            >
              {num}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 min-h-0 bg-editor text-editor-foreground font-mono text-sm leading-5 p-3 resize-none outline-none placeholder:text-muted-foreground/30 overflow-auto"
          style={{ tabSize: 2, fontSize: "16px" }}
          aria-label={label}
        />
      </div>
    </div>
  );
}
