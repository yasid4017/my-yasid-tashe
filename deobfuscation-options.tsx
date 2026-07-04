"use client";

import type {
  DeobfuscationOptions,
  ObfuscatorPreset,
} from "@/lib/lua-deobfuscator";

interface OptionToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function OptionToggle({
  label,
  description,
  checked,
  onChange,
}: OptionToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 w-full p-3 rounded-md text-left transition-colors min-h-[44px] ${
        checked
          ? "bg-accent/40 border border-primary/30"
          : "bg-secondary/50 border border-transparent hover:bg-secondary"
      }`}
    >
      <div
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
          checked
            ? "bg-primary border-primary"
            : "border-muted-foreground/40"
        }`}
      >
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className="text-primary-foreground"
          >
            <path
              d="M8.5 2.5L3.5 7.5L1.5 5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </div>
      </div>
    </button>
  );
}

interface DeobfuscationOptionsPanelProps {
  options: DeobfuscationOptions;
  onChange: (options: DeobfuscationOptions) => void;
}

const presets: { value: ObfuscatorPreset; label: string; tag: string }[] = [
  { value: "generic", label: "Generic", tag: "Universal" },
  { value: "moonsec-v3", label: "MoonSec V3", tag: "Bytecode VM" },
  { value: "wearedevs", label: "WeAreDevs", tag: "Table-based" },
];

interface OptionDef {
  key: keyof DeobfuscationOptions;
  label: string;
  description: string;
  preset?: ObfuscatorPreset;
}

const optionDefinitions: OptionDef[] = [
  // MoonSec V3 specific
  {
    key: "moonsecStripWrapper",
    label: "Strip VM Wrapper",
    description:
      "Remove gsub banner, _ENV proxy, bytecode payload, and outer IIFE shell",
    preset: "moonsec-v3",
  },
  {
    key: "moonsecDecodeStringConstants",
    label: "Decode String Constants",
    description:
      "Parse bytecode string table (\\DDD byte sequences) into readable names",
    preset: "moonsec-v3",
  },
  {
    key: "moonsecSimplifyControlFlow",
    label: "Simplify Control Flow",
    description:
      "Evaluate modular arithmetic state machines and resolve constant conditions",
    preset: "moonsec-v3",
  },
  {
    key: "moonsecExtractVMDispatches",
    label: "Extract VM Dispatches",
    description:
      "Find and label X[Y[Z]]=W[Y[V]] register operations (from MoonsecV3Dumper)",
    preset: "moonsec-v3",
  },
  {
    key: "moonsecIdentifyFunctions",
    label: "Identify VM Functions",
    description:
      "Label bytecode getter, anti-tamper, env access, and string loader functions",
    preset: "moonsec-v3",
  },
  // WeAreDevs specific
  {
    key: "wearedevsDecodeEscapes",
    label: "Decode Escape Sequences",
    description:
      "Resolve \\DDD decimal escapes, \\xHH hex escapes, and concat chains",
    preset: "wearedevs",
  },
  {
    key: "wearedevsResolveTableLookups",
    label: "Resolve Table Lookups",
    description:
      "Inline values from obfuscation lookup tables like _tbl[3]",
    preset: "wearedevs",
  },
  {
    key: "wearedevsRemoveProxyFunctions",
    label: "Remove Proxy Functions",
    description:
      "Replace aliased builtins (_print = print) and proxy wrappers",
    preset: "wearedevs",
  },
  {
    key: "wearedevsRemoveOpaquePredicates",
    label: "Remove Opaque Predicates",
    description:
      "Strip always-true/false conditions like if 1+1==2 then",
    preset: "wearedevs",
  },
  // Generic passes
  {
    key: "decodeStrings",
    label: "Decode Strings",
    description:
      "Decode hex, decimal, and string.char() encoded strings",
  },
  {
    key: "renameVariables",
    label: "Rename Variables",
    description: "Replace obfuscated identifiers with readable names",
  },
  {
    key: "simplifyExpressions",
    label: "Simplify Expressions",
    description: "Evaluate constant arithmetic and boolean expressions",
  },
  {
    key: "removeDeadCode",
    label: "Remove Dead Code",
    description: "Strip unreachable branches and empty blocks",
  },
  {
    key: "unwrapFunctions",
    label: "Unwrap IIFEs",
    description: "Inline immediately invoked function expressions",
  },
  {
    key: "reformatCode",
    label: "Reformat Code",
    description: "Re-indent and clean up whitespace",
  },
];

export function DeobfuscationOptionsPanel({
  options,
  onChange,
}: DeobfuscationOptionsPanelProps) {
  const activePreset = options.preset;

  const presetOptions = optionDefinitions.filter(
    (d) => d.preset === activePreset
  );
  const genericOptions = optionDefinitions.filter((d) => !d.preset);

  return (
    <div className="flex flex-col gap-4">
      {/* Preset selector */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Obfuscator Preset
        </h3>
        <div className="flex flex-col gap-1.5">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ ...options, preset: p.value })}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md text-left transition-colors min-h-[44px] ${
                activePreset === p.value
                  ? "bg-primary/15 border border-primary/40 text-foreground"
                  : "bg-secondary/50 border border-transparent hover:bg-secondary text-muted-foreground"
              }`}
            >
              <span className="text-sm font-medium">{p.label}</span>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  activePreset === p.value
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preset-specific passes */}
      {presetOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {activePreset === "moonsec-v3"
              ? "MoonSec V3 Passes"
              : "WeAreDevs Passes"}
          </h3>
          {presetOptions.map((def) => (
            <OptionToggle
              key={def.key}
              label={def.label}
              description={def.description}
              checked={options[def.key] as boolean}
              onChange={(checked) =>
                onChange({ ...options, [def.key]: checked })
              }
            />
          ))}
        </div>
      )}

      {/* Generic passes */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          General Passes
        </h3>
        {genericOptions.map((def) => (
          <OptionToggle
            key={def.key}
            label={def.label}
            description={def.description}
            checked={options[def.key] as boolean}
            onChange={(checked) =>
              onChange({ ...options, [def.key]: checked })
            }
          />
        ))}
      </div>
    </div>
  );
}
