export type ObfuscatorPreset = "generic" | "moonsec-v3" | "wearedevs";

export interface DeobfuscationOptions {
  preset: ObfuscatorPreset;
  // Generic passes
  renameVariables: boolean;
  decodeStrings: boolean;
  simplifyExpressions: boolean;
  removeDeadCode: boolean;
  reformatCode: boolean;
  unwrapFunctions: boolean;
  // MoonSec V3 specific
  moonsecStripWrapper: boolean;
  moonsecExtractVMDispatches: boolean;
  moonsecDecodeStringConstants: boolean;
  moonsecSimplifyControlFlow: boolean;
  moonsecIdentifyFunctions: boolean;
  // WeAreDevs specific
  wearedevsDecodeEscapes: boolean;
  wearedevsResolveTableLookups: boolean;
  wearedevsRemoveProxyFunctions: boolean;
  wearedevsRemoveOpaquePredicates: boolean;
}

export const defaultOptions: DeobfuscationOptions = {
  preset: "generic",
  renameVariables: true,
  decodeStrings: true,
  simplifyExpressions: true,
  removeDeadCode: true,
  reformatCode: true,
  unwrapFunctions: true,
  moonsecStripWrapper: true,
  moonsecExtractVMDispatches: true,
  moonsecDecodeStringConstants: true,
  moonsecSimplifyControlFlow: true,
  moonsecIdentifyFunctions: true,
  wearedevsDecodeEscapes: true,
  wearedevsResolveTableLookups: true,
  wearedevsRemoveProxyFunctions: true,
  wearedevsRemoveOpaquePredicates: true,
};

// ──────────────────────────────────────────────
// SHARED UTILITIES
// ──────────────────────────────────────────────

function decodeHexInContent(s: string): string {
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

function decodeDecimalInContent(s: string): string {
  return s.replace(/\\(\d{1,3})/g, (_m, num) => {
    const code = Number.parseInt(num, 10);
    if (code >= 0 && code <= 255) {
      return String.fromCharCode(code);
    }
    return _m;
  });
}

function decodeLuaStringContent(s: string): string {
  let r = s;
  r = decodeHexInContent(r);
  r = decodeDecimalInContent(r);
  r = r.replace(/\\n/g, "\n");
  r = r.replace(/\\t/g, "\t");
  r = r.replace(/\\r/g, "\r");
  r = r.replace(/\\\\/g, "\\");
  return r;
}

// ──────────────────────────────────────────────
// GENERIC PASSES
// ──────────────────────────────────────────────

function decodeHexEscapes(code: string): string {
  return code.replace(
    /(["'])((?:[^"'\\]|\\.)*)(\1)/g,
    (full, q, content, _q2) => {
      if (!/\\x[0-9a-fA-F]{2}/.test(content)) return full;
      return `${q}${decodeHexInContent(content)}${q}`;
    }
  );
}

function decodeDecimalEscapes(code: string): string {
  return code.replace(
    /(["'])((?:[^"'\\]|\\.)+)\1/g,
    (full, q, content) => {
      if (!/\\\d{1,3}/.test(content)) return full;
      return `${q}${decodeDecimalInContent(content)}${q}`;
    }
  );
}

function decodeStringChar(code: string): string {
  return code.replace(
    /string\s*\.\s*char\s*\(([0-9,\s]+)\)/g,
    (_, nums: string) => {
      const chars = nums
        .split(",")
        .map((n) => String.fromCharCode(Number.parseInt(n.trim(), 10)))
        .join("");
      return `"${chars}"`;
    }
  );
}

function simplifyArithmetic(code: string): string {
  let result = code;
  const patterns: [RegExp, (a: number, b: number) => number][] = [
    [/\((\d+)\s*\+\s*(\d+)\)/g, (a, b) => a + b],
    [/\((\d+)\s*\-\s*(\d+)\)/g, (a, b) => a - b],
    [/\((\d+)\s*\*\s*(\d+)\)/g, (a, b) => a * b],
    [/\((\d+)\s*\/\s*(\d+)\)/g, (a, b) => Math.floor(a / b)],
    [/\((\d+)\s*\%\s*(\d+)\)/g, (a, b) => a % b],
  ];
  for (const [pattern, op] of patterns) {
    result = result.replace(pattern, (_, a, b) =>
      String(op(Number.parseInt(a, 10), Number.parseInt(b, 10)))
    );
  }
  return result;
}

function simplifyBooleans(code: string): string {
  let result = code;
  result = result.replace(/not\s+true/g, "false");
  result = result.replace(/not\s+false/g, "true");
  result = result.replace(/true\s+and\s+true/g, "true");
  result = result.replace(/true\s+and\s+false/g, "false");
  result = result.replace(/false\s+and\s+true/g, "false");
  result = result.replace(/false\s+and\s+false/g, "false");
  result = result.replace(/true\s+or\s+/g, "true");
  result = result.replace(/false\s+or\s+/g, "");
  return result;
}

function removeDeadCode(code: string): string {
  let result = code;
  result = result.replace(/if\s+false\s+then\s*[\s\S]*?end/g, "");
  result = result.replace(/while\s+false\s+do\s*[\s\S]*?end/g, "");
  result = result.replace(/do\s*end/g, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

function renameVariables(code: string): string {
  let result = code;
  const varCounter = { local: 0, func: 0 };

  const obfuscatedPatterns = [
    /\b(local\s+)([_a-zA-Z][IlO01_]{4,})\b/g,
    /\b(local\s+)(\_0x[0-9a-fA-F]+)\b/g,
    /\b(local\s+)(v_[0-9]+)\b/g,
    // MoonSec-style: L_NNN_ or L_NNN_argN
    /\b(local\s+)(L_\d+_\w*)\b/g,
  ];

  const renames = new Map<string, string>();

  for (const pattern of obfuscatedPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match = regex.exec(result);
    while (match !== null) {
      const oldName = match[2];
      if (!renames.has(oldName)) {
        varCounter.local++;
        renames.set(oldName, `var_${varCounter.local}`);
      }
      match = regex.exec(result);
    }
  }

  const funcPattern = /\b(function\s+)([_a-zA-Z][IlO01_]{4,})\s*\(/g;
  let funcMatch = funcPattern.exec(result);
  while (funcMatch !== null) {
    const oldName = funcMatch[2];
    if (!renames.has(oldName)) {
      varCounter.func++;
      renames.set(oldName, `func_${varCounter.func}`);
    }
    funcMatch = funcPattern.exec(result);
  }

  for (const [oldName, newName] of renames) {
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), newName);
  }

  return result;
}

function unwrapIIFE(code: string): string {
  return code.replace(
    /\(\s*function\s*\([^)]*\)\s*\n?([\s\S]*?)\n?\s*end\s*\)\s*\([^)]*\)/g,
    (_, body) => body.trim()
  );
}

function simplifyStringConcat(code: string): string {
  let result = code;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(
      /(["'])([^"']*)\1\s*\.\.\s*(["'])([^"']*)\3/g,
      (_, q1, s1, _q2, s2) => `${q1}${s1}${s2}${q1}`
    );
  }
  return result;
}

function reformatLua(code: string): string {
  const lines = code.split("\n");
  let indent = 0;
  const indentStr = "  ";
  const result: string[] = [];

  const increaseIndent =
    /^\s*(function|if|for|while|repeat|do|else|elseif)\b/;
  const decreaseIndent = /^\s*(end|else|elseif|until)\b/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      result.push("");
      continue;
    }

    const isSingleLine =
      /^(if\b.+\bthen\b.+\bend)/.test(line) ||
      /^(function\b.+\bend)/.test(line) ||
      /^(for\b.+\bend)/.test(line);

    if (isSingleLine) {
      result.push(indentStr.repeat(indent) + line);
      continue;
    }

    if (decreaseIndent.test(line)) {
      indent = Math.max(0, indent - 1);
    }

    result.push(indentStr.repeat(indent) + line);

    if (increaseIndent.test(line) && !line.endsWith("end")) {
      indent++;
    }
  }

  return result.join("\n");
}

// ──────────────────────────────────────────────
// MOONSEC V3 SPECIFIC PASSES
// Based on: github.com/richdentistboy/MoonsecV3Dumper/v3
// ──────────────────────────────────────────────

/**
 * Strip the MoonSec V3 outer wrapper:
 * - gsub banner: ([[...MoonSec...]]):gsub('.+', (function(a) VAR=a end))
 * - ENV proxy: VAR=_ENV
 * - Massive encoded payload string (the very long line of random chars)
 * - return(function(a,...) ... end) outer shell
 */
function moonsecStripWrapper(code: string): string {
  let result = code;

  // Remove the gsub banner line that stores the encoded payload
  // Pattern: ([[...MoonSec...text...]]):gsub('.+', (function(a) VAR=a end))
  result = result.replace(
    /\(\[\[.*?\]\]\)\s*:gsub\s*\(\s*['"]\.[\+\*]['"][^)]*\(function\s*\(\w+\)\s*\w+=\w+\s*end\)\s*\)/g,
    "-- [MoonSec gsub banner removed]"
  );

  // Remove _ENV proxy assignment: VAR=_ENV
  result = result.replace(
    /^\s*\w+=_ENV\s*;?\s*$/gm,
    "-- [ENV proxy removed]"
  );

  // Remove the huge encoded payload string (>200 chars of mixed alphanumeric + special)
  // These look like: VAR='1:!csa3d=;9#OrNQOO=...' (very long)
  result = result.replace(
    /^\s*\w+\s*=\s*'[^']{200,}'\s*$/gm,
    "-- [Encoded bytecode payload removed]"
  );
  result = result.replace(
    /^\s*\w+\s*=\s*"[^"]{200,}"\s*$/gm,
    "-- [Encoded bytecode payload removed]"
  );

  // Unwrap the outer return(function(a,...) ... end) VM wrapper
  // This is the main VM interpreter function
  const returnFuncMatch = result.match(
    /return\s*\(\s*function\s*\((\w+)\s*,\s*\.\.\.\)/
  );
  if (returnFuncMatch) {
    const idx = result.indexOf(returnFuncMatch[0]);
    if (idx !== -1) {
      // Find the body start
      const bodyStart = idx + returnFuncMatch[0].length;
      // We can't easily find the matching end of a massive function,
      // so we'll mark it and let the user see the internals
      result =
        result.substring(0, idx) +
        "-- [VM interpreter entry point]\n-- function(VM_arg, ...)\n" +
        result.substring(bodyStart);
    }
  }

  // Remove long base64 bytecode assignments
  result = result.replace(
    /local\s+\w+\s*=\s*"[A-Za-z0-9+/=]{100,}"/g,
    "-- [Base64 bytecode removed]"
  );

  return result;
}

/**
 * Extract and label VM dispatch operations.
 * MoonSec V3 uses register assignment patterns:
 *   X[Y[Z]] = W[Y[V]];
 * This is the exact regex from the MoonsecV3Dumper repo.
 * We label each one and optionally add print statements for runtime dumping.
 */
function moonsecExtractVMDispatches(code: string): string {
  let result = code;

  // The core regex from richdentistboy's dumper.js:
  // (.+)\[(.+)\[(.+)\]\] = (.+)\[(.+)\[(.+)\]\];
  const vmDispatchRegex =
    /(.+)\[(.+)\[(.+)\]\]\s*=\s*(.+)\[(.+)\[(.+)\]\]\s*;/gm;

  const dispatches: Array<{ full: string; index: number }> = [];
  let dispatchMatch: RegExpExecArray | null;

  while ((dispatchMatch = vmDispatchRegex.exec(result)) !== null) {
    // Filter out lines containing math operators (as the dumper does)
    if (/[+\-*/%#]/.test(dispatchMatch[0])) continue;
    dispatches.push({ full: dispatchMatch[0], index: dispatches.length });
  }

  if (dispatches.length > 0) {
    // Label each dispatch with its index
    for (let i = dispatches.length - 1; i >= 0; i--) {
      const d = dispatches[i];
      result = result.replace(
        d.full,
        `${d.full} --[[ VM_DISPATCH[${i}] ]]`
      );
    }

    // Add a summary comment at the top
    result =
      `-- [MoonSec V3: Found ${dispatches.length} VM dispatch operations]\n` +
      `-- These are register/stack assignments from the bytecode interpreter.\n` +
      `-- To fully deobfuscate, run the instrumented code in a Lua environment\n` +
      `-- to dump actual values at each dispatch point.\n\n` +
      result;
  }

  return result;
}

/**
 * Decode embedded string constants from the bytecode data.
 * MoonSec V3 stores strings as sequences of decimal bytes:
 *   \4\8\116\111\110\117\109\98\101\114...
 * Where:
 *   First byte = type tag (\0=table.field, \2=tonumber, \3=boolean, \4=global, \5=end, \6=env_func)
 *   Second byte = length of the name
 *   Next N bytes = the name
 *   Last 8 bytes = key/hash
 */
function moonsecDecodeStringConstants(code: string): string {
  let result = code;

  // Find the embedded constant data pattern (long sequence of \DDD)
  const constDataRegex =
    /["']((\\[0-9]{1,3}){20,})["']/g;

  let constMatch: RegExpExecArray | null;
  const decodedTables: string[] = [];

  while ((constMatch = constDataRegex.exec(result)) !== null) {
    const raw = constMatch[1];
    // Parse the byte sequence
    const bytes: number[] = [];
    const byteRegex = /\\(\d{1,3})/g;
    let bm: RegExpExecArray | null;
    while ((bm = byteRegex.exec(raw)) !== null) {
      bytes.push(Number.parseInt(bm[1], 10));
    }

    if (bytes.length < 3) continue;

    // Walk the byte stream extracting string constants
    const strings: Array<{ type: number; name: string; key: string }> = [];
    let pos = 0;

    while (pos < bytes.length) {
      const typeTag = bytes[pos];
      pos++;

      if (typeTag === 5) break; // end marker

      if (pos >= bytes.length) break;
      const nameLen = bytes[pos];
      pos++;

      if (pos + nameLen > bytes.length) break;

      const nameChars: string[] = [];
      for (let i = 0; i < nameLen; i++) {
        const b = bytes[pos + i];
        if (b >= 32 && b <= 126) {
          nameChars.push(String.fromCharCode(b));
        }
      }
      pos += nameLen;

      const name = nameChars.join("");

      // Read the 8-byte key
      const keyChars: string[] = [];
      const keyLen = Math.min(8, bytes.length - pos);
      for (let i = 0; i < keyLen; i++) {
        const b = bytes[pos + i];
        if (b >= 32 && b <= 126) {
          keyChars.push(String.fromCharCode(b));
        }
      }
      pos += keyLen;

      const key = keyChars.join("");
      const typeNames: Record<number, string> = {
        0: "table.field",
        2: "tonumber",
        3: "boolean",
        4: "global",
        6: "env_func",
      };

      if (name.length > 0) {
        strings.push({
          type: typeTag,
          name,
          key,
        });
      }
    }

    if (strings.length > 0) {
      // Build a readable string table
      const tableStr = strings
        .map(
          (s, i) =>
            `--   [${i}] ${s.name} (type=${s.type}/${["table.field", "", "tonumber", "boolean", "global", "end", "env_func"][s.type] || "unknown"}, key="${s.key}")`
        )
        .join("\n");

      decodedTables.push(tableStr);

      // Replace the raw bytes with a comment showing the decoded table
      result = result.replace(
        constMatch[0],
        `"" -- [Decoded ${strings.length} string constants]\n${tableStr}`
      );
    }
  }

  // Also decode individual short decimal-encoded strings
  result = decodeDecimalEscapes(result);
  result = decodeHexEscapes(result);

  return result;
}

/**
 * Simplify MoonSec V3 modular arithmetic control flow.
 * The VM uses patterns like:
 *   local h = 24915
 *   while i < 906 do
 *     h = (h - 740) % 24206
 *     if (h % 7878) >= 3939 then ...
 *
 * We can:
 * 1. Evaluate constant modular arithmetic expressions
 * 2. Resolve constant if-conditions with known numeric comparisons
 * 3. Simplify nested while loops with constant bounds
 */
function moonsecSimplifyControlFlow(code: string): string {
  let result = code;

  // Evaluate (N op N) % M patterns
  result = result.replace(
    /\((\w+)\s*([+\-*])\s*(\d+)\)\s*%\s*(\d+)/g,
    (full, varName, op, num, mod) => {
      // If variable is unknown, keep the expression but note it
      if (/^\d+$/.test(varName)) {
        const a = Number.parseInt(varName, 10);
        const b = Number.parseInt(num, 10);
        const m = Number.parseInt(mod, 10);
        let val: number;
        if (op === "+") val = (a + b) % m;
        else if (op === "-") val = ((a - b) % m + m) % m;
        else val = (a * b) % m;
        return String(val);
      }
      return full;
    }
  );

  // Resolve if(CONST OP CONST) patterns in the state machine
  result = result.replace(
    /if\s*\(?\s*(\d+)\s*%\s*(\d+)\s*\)?\s*([><=~!]+)\s*(\d+)\s*then/g,
    (full, a, b, op, c) => {
      const lhs = Number.parseInt(a, 10) % Number.parseInt(b, 10);
      const rhs = Number.parseInt(c, 10);
      let cond: boolean | null = null;
      if (op === ">=") cond = lhs >= rhs;
      else if (op === "<=") cond = lhs <= rhs;
      else if (op === ">") cond = lhs > rhs;
      else if (op === "<") cond = lhs < rhs;
      else if (op === "==" || op === "===") cond = lhs === rhs;
      else if (op === "~=" || op === "!=") cond = lhs !== rhs;

      if (cond === true) return `if true then --[[ ${a}%${b} ${op} ${c} = true ]]`;
      if (cond === false) return `if false then --[[ ${a}%${b} ${op} ${c} = false ]]`;
      return full;
    }
  );

  // Also handle h%N >= M without parens
  result = result.replace(
    /if\s*\(?(\w+)\s*%\s*(\d+)\s*\)?\s*([><=~!]+)\s*(\d+)\s*then/g,
    (full, _v, _b, _op, _c) => {
      // We can't resolve these without knowing variable state at runtime
      return full;
    }
  );

  // Clean up: remove if false then ... end blocks that we just created
  result = removeDeadCode(result);

  // Simplify `not j[N]` guard patterns used for one-time initialization
  // if not j[a] then j[a]=1; <code> end => <code> --[[ init guard ]]
  result = result.replace(
    /if\s+not\s+(\w+)\[(\w+)\]\s*then\s+\1\[\2\]\s*=\s*1\s*;?\s*([\s\S]*?)\s*end/g,
    (_, _guard, _key, body) => {
      return `${body.trim()} --[[ one-time init ]]`;
    }
  );

  return result;
}

/**
 * Identify and label key MoonSec V3 VM functions:
 * - Bytecode getter: local function X(Y) return Z[Y] end
 * - Anti-tamper check: if X ~= Y then local Z = W;
 * - String builder function (type tag \6): b[e] = function(b,c) return a(8,nil,a,c,b) end
 * - getfenv/setfenv environment access
 */
function moonsecIdentifyFunctions(code: string): string {
  let result = code;

  // Bytecode getter function (exact pattern from BETA_DUMPER.js)
  // local function X(Y) return Z[Y] end
  result = result.replace(
    /local\s+function\s+(\w+)\s*\((\w+)\)\s*return\s+(\w+)\[(\2)\]\s*end/g,
    (full, funcName, _param, tableName) => {
      return `${full} --[[ BYTECODE_GETTER: ${funcName} reads from ${tableName} ]]`;
    }
  );

  // Anti-tamper check (from BETA_DUMPER.js): if X ~= Y then local Z = W;
  result = result.replace(
    /if\s+(\w+)\s*~=\s*(\w+)\s+then\s+local\s+(\w+)\s*=\s*(\w+)\s*;/g,
    (full) => {
      return `${full} --[[ ANTI_TAMPER_CHECK ]]`;
    }
  );

  // getfenv pattern (environment access)
  result = result.replace(
    /(\w+)\s*=\s*getfenv\s*\(\s*\)\s*(?:and\s+getfenv\s*\(\s*\))?/g,
    (full) => `${full} --[[ ENV_ACCESS ]]`
  );

  // Environment setup: (not VAR) and _ENV or VAR
  result = result.replace(
    /\(not\s+(\w+)\)\s*and\s+_ENV\s+or\s+\1/g,
    (full) => `${full} --[[ ENV_SETUP: fallback to _ENV ]]`
  );

  // String module assignment (usually g = string)
  result = result.replace(
    /(\w+)\s*=\s*string\b(?!\s*[.[])/g,
    (full, varName) =>
      `${full} --[[ STRING_MODULE: ${varName} = string ]]`
  );

  // The string builder / constant loader function
  // f = function(d) local e=1; local function f(a) e=e+a; return d:sub(e-a,e-1) end ...
  result = result.replace(
    /(\w+)\s*=\s*function\s*\((\w+)\)\s*local\s+(\w+)\s*=\s*1\s*;?\s*local\s+function\s+(\w+)\s*\((\w+)\)\s*\3\s*=\s*\3\s*\+\s*\5\s*;?\s*return\s+\2\s*:\s*sub\s*\(\s*\3\s*-\s*\5\s*,\s*\3\s*-\s*1\s*\)/g,
    (full) => `${full} --[[ STRING_CONSTANT_LOADER: parses bytecode string table ]]`
  );

  return result;
}

// ──────────────────────────────────────────────
// WEAREDEVS SPECIFIC PASSES
// ──────────────────────────────────────────────

function wearedevsDecodeEscapes(code: string): string {
  let result = code;
  result = decodeDecimalEscapes(result);
  result = decodeHexEscapes(result);
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(
      /(["'])([^"']*)\1\s*\.\.\s*(["'])([^"']*)\3/g,
      (_, q1, s1, _q2, s2) => `${q1}${s1}${s2}${q1}`
    );
  }
  return result;
}

function wearedevsResolveTableLookups(code: string): string {
  let result = code;

  const tableRegex =
    /local\s+(\w+)\s*=\s*\{\s*((?:(?:"[^"]*"|'[^']*'|[^{}]+)\s*,?\s*)+)\}/g;

  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(result)) !== null) {
    const tableName = tableMatch[1];
    const tableContent = tableMatch[2];

    const entries: string[] = [];
    let current = "";
    let inStr: string | null = null;
    for (const ch of tableContent) {
      if (!inStr && (ch === '"' || ch === "'")) {
        inStr = ch;
        current += ch;
      } else if (inStr && ch === inStr) {
        inStr = null;
        current += ch;
      } else if (!inStr && ch === ",") {
        if (current.trim()) entries.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) entries.push(current.trim());

    if (entries.length > 0) {
      const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`${escaped}\\[\\s*(\\d+)\\s*\\]`, "g"),
        (original, idx) => {
          const i = Number.parseInt(idx, 10) - 1;
          if (i >= 0 && i < entries.length) {
            return entries[i];
          }
          return original;
        }
      );
    }
  }

  return result;
}

function wearedevsRemoveProxyFunctions(code: string): string {
  let result = code;

  const builtins = new Set([
    "print", "tostring", "tonumber", "type", "error", "pcall", "xpcall",
    "select", "unpack", "rawget", "rawset", "rawequal", "setmetatable",
    "getmetatable", "next", "pairs", "ipairs", "assert", "require",
    "loadstring", "dofile", "loadfile", "collectgarbage", "coroutine",
    "string", "table", "math", "io", "os", "debug", "game", "workspace",
    "Instance", "Vector3", "CFrame", "Color3", "BrickColor", "Enum",
    "wait", "spawn", "delay", "tick", "time", "warn", "typeof",
  ]);

  const aliasPattern = /local\s+(\w+)\s*=\s*(\w+(?:\.\w+)?)\s*\n/g;
  const aliases = new Map<string, string>();

  let aliasMatch: RegExpExecArray | null;
  while ((aliasMatch = aliasPattern.exec(result)) !== null) {
    const alias = aliasMatch[1];
    const target = aliasMatch[2];
    const baseName = target.split(".")[0];
    if (builtins.has(baseName) || builtins.has(target)) {
      aliases.set(alias, target);
    }
  }

  for (const [alias, target] of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `local\\s+${escapedAlias}\\s*=\\s*${escapedTarget}\\s*\\n`,
        "g"
      ),
      ""
    );
    result = result.replace(
      new RegExp(`\\b${escapedAlias}\\b`, "g"),
      target
    );
  }

  const proxyFuncRegex =
    /local\s+function\s+(\w+)\s*\(([^)]*)\)\s*return\s+(\w+(?:\.\w+)?)\s*\(\2\)\s*end/g;
  const proxies = new Map<string, string>();
  let proxyMatch: RegExpExecArray | null;
  while ((proxyMatch = proxyFuncRegex.exec(result)) !== null) {
    proxies.set(proxyMatch[1], proxyMatch[3]);
  }

  for (const [funcName, target] of proxies) {
    const escapedName = funcName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `local\\s+function\\s+${escapedName}\\s*\\([^)]*\\)\\s*return\\s+\\w+(?:\\.\\w+)?\\s*\\([^)]*\\)\\s*end`,
        "g"
      ),
      ""
    );
    result = result.replace(
      new RegExp(`\\b${escapedName}\\s*\\(`, "g"),
      `${target}(`
    );
  }

  return result;
}

function wearedevsRemoveOpaquePredicates(code: string): string {
  let result = code;

  result = result.replace(
    /if\s*\(?(\d+)\s*\+\s*(\d+)\)?\s*==\s*(\d+)\s*then\s*\n?([\s\S]*?)(?:\s*else\s*\n?[\s\S]*?)?\s*end/g,
    (full, a, b, c, body) => {
      const sum = Number.parseInt(a, 10) + Number.parseInt(b, 10);
      return sum === Number.parseInt(c, 10) ? body.trim() : full;
    }
  );

  result = result.replace(
    /if\s*(["'])([^"']*)\1\s*==\s*(["'])([^"']*)\3\s*then\s*\n?([\s\S]*?)(?:\s*else\s*\n?[\s\S]*?)?\s*end/g,
    (full, _q1, s1, _q2, s2, body) => {
      return s1 === s2 ? body.trim() : full;
    }
  );

  result = result.replace(
    /if\s*\(?\s*(\d+)\s*([><=~!]+)\s*(\d+)\s*\)?\s*then\s*\n?([\s\S]*?)\s*end/g,
    (full, a, op, b, body) => {
      const numA = Number.parseInt(a, 10);
      const numB = Number.parseInt(b, 10);
      let r: boolean | null = null;
      if (op === ">") r = numA > numB;
      else if (op === "<") r = numA < numB;
      else if (op === ">=") r = numA >= numB;
      else if (op === "<=") r = numA <= numB;
      else if (op === "==" || op === "===") r = numA === numB;
      else if (op === "~=" || op === "!=") r = numA !== numB;
      if (r === true) return body.trim();
      if (r === false) return "";
      return full;
    }
  );

  return result;
}

// ──────────────────────────────────────────────
// MAIN ENTRY POINT
// ──────────────────────────────────────────────

export function deobfuscate(
  code: string,
  options: DeobfuscationOptions
): { result: string; passes: string[] } {
  let result = code;
  const passes: string[] = [];
  const preset = options.preset;

  // ── MoonSec V3 pipeline ──
  if (preset === "moonsec-v3") {
    if (options.moonsecStripWrapper) {
      const before = result;
      result = moonsecStripWrapper(result);
      if (result !== before) {
        passes.push("[MoonSec] Stripped gsub banner, ENV proxy, and VM wrapper");
      }
    }

    if (options.moonsecDecodeStringConstants) {
      const before = result;
      result = moonsecDecodeStringConstants(result);
      if (result !== before) {
        passes.push("[MoonSec] Decoded embedded string constants from bytecode");
      }
    }

    if (options.moonsecSimplifyControlFlow) {
      const before = result;
      result = moonsecSimplifyControlFlow(result);
      if (result !== before) {
        passes.push("[MoonSec] Simplified modular arithmetic control flow");
      }
    }

    if (options.moonsecExtractVMDispatches) {
      const before = result;
      result = moonsecExtractVMDispatches(result);
      if (result !== before) {
        passes.push("[MoonSec] Extracted and labeled VM dispatch operations");
      }
    }

    if (options.moonsecIdentifyFunctions) {
      const before = result;
      result = moonsecIdentifyFunctions(result);
      if (result !== before) {
        passes.push("[MoonSec] Identified VM functions (bytecode getter, anti-tamper, env)");
      }
    }
  }

  // ── WeAreDevs pipeline ──
  if (preset === "wearedevs") {
    if (options.wearedevsDecodeEscapes) {
      result = wearedevsDecodeEscapes(result);
      passes.push("[WeAreDevs] Decoded escape sequences and concat chains");
    }

    if (options.wearedevsResolveTableLookups) {
      result = wearedevsResolveTableLookups(result);
      passes.push("[WeAreDevs] Resolved table-based lookups");
    }

    if (options.wearedevsRemoveProxyFunctions) {
      result = wearedevsRemoveProxyFunctions(result);
      passes.push("[WeAreDevs] Removed proxy functions and aliases");
    }

    if (options.wearedevsRemoveOpaquePredicates) {
      result = wearedevsRemoveOpaquePredicates(result);
      passes.push("[WeAreDevs] Removed opaque predicates");
    }
  }

  // ── Generic passes (run for all presets) ──
  if (options.decodeStrings) {
    result = decodeHexEscapes(result);
    result = decodeDecimalEscapes(result);
    result = decodeStringChar(result);
    result = simplifyStringConcat(result);
    passes.push("Decoded obfuscated strings");
  }

  if (options.simplifyExpressions) {
    for (let i = 0; i < 3; i++) {
      result = simplifyArithmetic(result);
    }
    result = simplifyBooleans(result);
    passes.push("Simplified constant expressions");
  }

  if (options.unwrapFunctions) {
    result = unwrapIIFE(result);
    passes.push("Unwrapped IIFE patterns");
  }

  if (options.removeDeadCode) {
    result = removeDeadCode(result);
    passes.push("Removed dead code blocks");
  }

  if (options.renameVariables) {
    result = renameVariables(result);
    passes.push("Renamed obfuscated identifiers");
  }

  if (options.reformatCode) {
    result = reformatLua(result);
    passes.push("Reformatted and re-indented code");
  }

  // Final cleanup
  result = result.replace(/\n{3,}/g, "\n\n");

  return { result: result.trim(), passes };
}
