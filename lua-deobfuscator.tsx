"use client";

import { useState, useCallback } from "react";
import { CodeEditor } from "@/components/code-editor";
import { DeobfuscationOptionsPanel } from "@/components/deobfuscation-options";
import { PassLog } from "@/components/pass-log";
import {
  deobfuscate,
  defaultOptions,
  type DeobfuscationOptions,
  type ObfuscatorPreset,
} from "@/lib/lua-deobfuscator";
import { Button } from "@/components/ui/button";

const SAMPLE_GENERIC = `-- Paste your obfuscated Lua code here
-- Generic obfuscation example:
local IlIlIlIl = string.char(72,101,108,108,111)
local IlIlIlII = string.char(87,111,114,108,100)
local function IlIlIIlI(IlIIlIlI)
  print(IlIIlIlI .. " " .. IlIlIlII)
end
if false then
  print("dead code")
end
local IlIIIlIl = (10 + 5)
IlIlIIlI(IlIIIlIl)`;

const SAMPLE_MOONSEC = `--discord.gg/boronide, code generated using luamin.js

([[This file was protected with MoonSec V3 by Federal#9999]]):gsub('.+',(function(a)_LMzDCrMkzIeD=a end))
qMJqCMmeAanlhWEH=_ENV;
UHYoOHxhBjOloEQ='1:!csa3d=;9#OrNQOO=Oa!:=N:9a39cbQ3cs=aaaSNrs;9#Qd!c;!O#O=:d3:dQ#ri3asdNOd:s:Q9O&=3#sddss?9rcs9ad!#Qa#a!=J9Odarc;N39Od!=a3rccQ=9cd#cQ?:##9!33!cNN9rdQ:9'
return(function(a,...)local b;local c;local d;local e;local f;local g;local h=24915;local i=0;local j={}while i<906 do i=i+1;while i<250 and h%7878<3939 do i=i+1;h=(h-740)%24206;local k=i+h;if(h%7928)>=3964 then h=(h*551)%6115;while i<455 and h%15544<7772 do i=i+1;h=(h*79)%29462;local a=i+h;if(h%4020)>=2010 then h=(h-896)%2279;local a=61464;if not j[a]then j[a]=1;b=(not b)and _ENV or b end elseif h%2~=0 then h=(h-173)%22868;local a=27254;if not j[a]then j[a]=1;b=getfenv and getfenv()end else h=(h*683)%38779;i=i+1;local a=93049;if not j[a]then j[a]=1;g=string end end end elseif h%2~=0 then h=(h-837)%49206;while i<861 and h%14338<7169 do i=i+1;h=(h-81)%30141;local d=i+h;if(h%8038)<=4019 then h=(h-138)%13652;local a=16875;if not j[a]then j[a]=1;c={}end elseif h%2~=0 then h=(h-309)%17502;local d=793;if not j[d]then j[d]=1;f=function(d)local e=1;local function f(a)e=e+a;return d:sub(e-a,e-1)end;while true do local d=f(1)if(d=="\\5")then break end;local e=g.byte(f(1))local e=f(e)if d=="\\2"then e=c.UgUCYMGC(e)elseif d=="\\3"then e=e~="\\0"elseif d=="\\6"then b[e]=function(b,c)return a(8,nil,a,c,b)end elseif d=="\\4"then e=b[e]elseif d=="\\0"then e=b[e][f(g.byte(f(1)))]end;local a=f(8)c[a]=e end end end else h=(h*49)%31431;i=i+1 end end else h=(h+981)%22120;i=i+1;while i<349 and h%4682<2341 do i=i+1;h=(h*520)%43676;local a=i+h;if(h%11912)>=5956 then h=(h-895)%9249;local a=73810;if not j[a]then j[a]=1;d=tonumber end end end end end;local e="\\4\\8\\116\\111\\110\\117\\109\\98\\101\\114\\85\\103\\85\\67\\89\\77\\71\\67\\0\\6\\115\\116\\114\\105\\110\\103\\4\\99\\104\\97\\114\\65\\70\\89\\119\\80\\72\\108\\79\\0\\6\\115\\116\\114\\105\\110\\103\\3\\115\\117\\98\\110\\73\\83\\68\\98\\65\\102\\79\\0\\6\\115\\116\\114\\105\\110\\103\\4\\98\\121\\116\\101\\72\\95\\86\\81\\109\\117\\120\\84\\5"
f(e)
local L_140_={}
local L_143_={}
L_140_[L_143_[L_21_]]=L_127_arg2[L_143_[L_20_]];
L_127_arg2[L_143_[L_20_]]=L_140_[L_143_[L_21_]];
end)`;

const SAMPLE_WEAREDEVS = `-- WeAreDevs Obfuscated Script
local _tbl = {print, tostring, "\\072\\101\\108\\108\\111", "\\087\\111\\114\\108\\100", pairs}
local _print = print
local _tostring = tostring
local _type = type
local function _wrapper(a) return print(a) end

if 1 + 1 == 2 then
  _print(_tbl[3] .. " " .. _tbl[4])
end

if "abc" == "abc" then
  local msg = "\\084\\104\\105\\115" .. " " .. "\\105\\115" .. " " .. "\\100\\101\\111\\098\\102\\117\\115\\099\\097\\116\\101\\100"
  _wrapper(msg)
end

if (5 > 10) then
  _print("you will never see this")
end

local result = _tbl[2](42)
_tbl[1]("The answer is: " .. result)`;

const SAMPLES: Record<ObfuscatorPreset, string> = {
  generic: SAMPLE_GENERIC,
  "moonsec-v3": SAMPLE_MOONSEC,
  wearedevs: SAMPLE_WEAREDEVS,
};

export function LuaDeobfuscator() {
  const [input, setInput] = useState(SAMPLES.generic);
  const [output, setOutput] = useState("");
  const [options, setOptions] = useState<DeobfuscationOptions>(defaultOptions);
  const [passes, setPasses] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleOptionsChange = useCallback(
    (newOptions: DeobfuscationOptions) => {
      // When preset changes, load matching sample code
      if (newOptions.preset !== options.preset) {
        setInput(SAMPLES[newOptions.preset]);
        setOutput("");
        setPasses([]);
      }
      setOptions(newOptions);
    },
    [options.preset]
  );

  const handleDeobfuscate = useCallback(() => {
    if (!input.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const { result, passes: appliedPasses } = deobfuscate(input, options);
      setOutput(result);
      setPasses(appliedPasses);
      setIsProcessing(false);
    }, 150);
  }, [input, options]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setPasses([]);
  }, []);

  const handleCopy = useCallback(() => {
    if (output) {
      navigator.clipboard.writeText(output);
    }
  }, [output]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">
              Lua Deobfuscator
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              MoonSec V3 / WeAreDevs / Generic
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOptions(!showOptions)}
            className="lg:hidden min-h-[44px] min-w-[44px]"
            aria-label="Toggle options"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="4" y1="21" y2="14" />
              <line x1="4" x2="4" y1="10" y2="3" />
              <line x1="12" x2="12" y1="21" y2="12" />
              <line x1="12" x2="12" y1="8" y2="3" />
              <line x1="20" x2="20" y1="21" y2="16" />
              <line x1="20" x2="20" y1="12" y2="3" />
              <line x1="2" x2="6" y1="14" y2="14" />
              <line x1="10" x2="14" y1="8" y2="8" />
              <line x1="18" x2="22" y1="16" y2="16" />
            </svg>
            <span className="ml-1.5 text-sm">Options</span>
          </Button>
        </div>
      </header>

      {/* Mobile options panel */}
      {showOptions && (
        <div className="lg:hidden border-b border-border p-4 bg-card">
          <DeobfuscationOptionsPanel
            options={options}
            onChange={handleOptionsChange}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Sidebar - desktop only */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-border p-4 gap-4 overflow-y-auto">
          <DeobfuscationOptionsPanel options={options} onChange={handleOptionsChange} />
          <PassLog passes={passes} />
        </aside>

        {/* Editors */}
        <main className="flex flex-1 min-h-0 flex-col">
          {/* Action bar */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-b border-border bg-card">
            <Button
              onClick={handleDeobfuscate}
              disabled={isProcessing || !input.trim()}
              className="min-h-[44px] px-6 font-semibold"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      className="opacity-75"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                  Deobfuscate
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput(SAMPLES[options.preset]);
                setOutput("");
                setPasses([]);
              }}
              className="min-h-[44px] bg-transparent"
            >
              Sample
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="min-h-[44px] bg-transparent"
            >
              Clear
            </Button>
            {output && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="min-h-[44px] bg-transparent"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy
              </Button>
            )}
          </div>

          {/* Code panels */}
          <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
            <div className="flex-1 min-h-[200px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-border">
              <CodeEditor
                value={input}
                onChange={setInput}
                placeholder="Paste your obfuscated Lua code here..."
                label="Obfuscated Input"
              />
            </div>
            <div className="flex-1 min-h-[200px] lg:min-h-0">
              <CodeEditor
                value={output}
                readOnly
                placeholder="Deobfuscated output will appear here..."
                label="Clean Output"
              />
            </div>
          </div>

          {/* Mobile pass log */}
          {passes.length > 0 && (
            <div className="lg:hidden p-4 border-t border-border">
              <PassLog passes={passes} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
