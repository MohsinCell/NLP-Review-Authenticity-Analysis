import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SvgCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;

}

function generateCaptchaText(): string {
  const chars = 'ACDEFGHJKLMNPQRTUVWXY3467';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCharPath(char: string, x: number, y: number, fontSize: number, rotation: number): string {
  return `<text
    x="${x}"
    y="${y}"
    font-family="'Courier New', monospace"
    font-size="${fontSize}"
    font-weight="${Math.random() > 0.5 ? 'bold' : 'normal'}"
    fill="rgba(255,255,255,${0.75 + Math.random() * 0.25})"
    transform="rotate(${rotation},${x},${y}) skewX(${Math.random() * 12 - 6})"
    style="letter-spacing: ${Math.random() * 2 - 1}px"
  >${char}</text>`;
}

function renderCaptchaSvg(text: string): string {
  const width = 180;
  const height = 60;

  let interferenceLines = '';
  for (let i = 0; i < 6; i++) {
    const x1 = Math.random() * width * 0.3;
    const y1 = Math.random() * height;
    const x2 = width * 0.7 + Math.random() * width * 0.3;
    const y2 = Math.random() * height;
    const cx1 = Math.random() * width;
    const cy1 = Math.random() * height;
    const cx2 = Math.random() * width;
    const cy2 = Math.random() * height;
    const opacity = 0.15 + Math.random() * 0.2;
    const strokeWidth = 1 + Math.random() * 1.5;
    interferenceLines += `<path d="M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}" stroke="rgba(255,255,255,${opacity})" stroke-width="${strokeWidth}" fill="none"/>`;
  }

  for (let i = 0; i < 4; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const opacity = 0.1 + Math.random() * 0.15;
    interferenceLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,${opacity})" stroke-width="${1 + Math.random()}"/>`;
  }

  let noiseDots = '';
  for (let i = 0; i < 50; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 0.5 + Math.random() * 2;
    const opacity = 0.08 + Math.random() * 0.15;
    noiseDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,${opacity})"/>`;
  }

  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const w = 1 + Math.random() * 4;
    const h = 1 + Math.random() * 4;
    const opacity = 0.05 + Math.random() * 0.1;
    const rotation = Math.random() * 360;
    noiseDots += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(255,255,255,${opacity})" transform="rotate(${rotation},${x},${y})"/>`;
  }

  let chars = '';
  const startX = 18;
  const spacing = 30 + Math.random() * 4;
  for (let i = 0; i < text.length; i++) {
    const x = startX + i * spacing + (Math.random() * 6 - 3);
    const y = 38 + (Math.random() * 10 - 5);
    const rotation = Math.random() * 35 - 17;
    const fontSize = 22 + Math.random() * 8;
    chars += generateCharPath(text[i], x, y, fontSize, rotation);
  }

  const decoyChars = 'XVNMKWZ';
  for (let i = 0; i < 2; i++) {
    const char = decoyChars[Math.floor(Math.random() * decoyChars.length)];
    const x = i === 0 ? -5 + Math.random() * 8 : width - 8 + Math.random() * 8;
    const y = 20 + Math.random() * 30;
    const opacity = 0.15 + Math.random() * 0.1;
    chars += `<text x="${x}" y="${y}" font-family="monospace" font-size="${18 + Math.random() * 6}" fill="rgba(255,255,255,${opacity})" transform="rotate(${Math.random() * 30 - 15},${x},${y})">${char}</text>`;
  }

  let wavePath = `<path d="M0,${height / 2}`;
  for (let x = 0; x <= width; x += 10) {
    wavePath += ` Q${x + 5},${height / 2 + Math.sin(x / 15) * 8} ${x + 10},${height / 2}`;
  }
  wavePath += `" stroke="rgba(255,255,255,0.06)" stroke-width="15" fill="none"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgba(255,255,255,0.03)"/>
        <stop offset="50%" style="stop-color:rgba(255,255,255,0.06)"/>
        <stop offset="100%" style="stop-color:rgba(255,255,255,0.03)"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="10"/>
    ${wavePath}
    ${interferenceLines}
    ${noiseDots}
    <g filter="url(#noise)">
      ${chars}
    </g>
  </svg>`;
}

export default function SvgCaptcha({ onVerify, onExpire }: SvgCaptchaProps) {
  const [captchaText, setCaptchaText] = useState('');
  const [svgContent, setSvgContent] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateNew = useCallback(() => {
    setIsRefreshing(true);
    const text = generateCaptchaText();
    setCaptchaText(text);
    setSvgContent(renderCaptchaSvg(text));
    setUserInput('');
    setError('');
    setVerified(false);
    onExpire?.();
    setTimeout(() => setIsRefreshing(false), 300);
  }, [onExpire]);

  useEffect(() => {
    generateNew();
  }, [generateNew]);

  const handleVerify = () => {
    if (userInput.toLowerCase() === captchaText.toLowerCase()) {
      setVerified(true);
      setError('');
      setAttempts(0);

      const token = btoa(`${captchaText}-${Date.now()}-verified`);
      onVerify(token);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(newAttempts >= 3 ? 'Multiple incorrect attempts. New code generated.' : 'Incorrect code. Please try again.');
      setUserInput('');
      generateNew();
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerify();
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3.5 transition-all duration-300">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-emerald-400">Verification complete</span>
          <span className="text-xs text-emerald-400/60">You can proceed with the form</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4">
        <div className="flex flex-col gap-3">

          <div className="flex justify-center sm:justify-start">
            <div
              className={`relative rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden select-none transition-all duration-300 ${
                isRefreshing ? 'opacity-40 scale-[0.98]' : 'opacity-100 scale-100'
              }`}
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            />
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value.replace(/\s/g, ''));
                  if (error) setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter code"
                maxLength={5}
                autoComplete="off"
                spellCheck={false}
                className={`flex-1 min-w-0 h-10 rounded-lg border bg-white/[0.03] px-3 text-sm text-white font-mono tracking-widest uppercase placeholder:text-white/25 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none transition-all duration-200 ${
                  error
                    ? 'border-red-500/40 focus:border-red-500/60'
                    : 'border-white/[0.08] focus:border-white/[0.2] focus:bg-white/[0.05]'
                }`}
              />

              <button
                type="button"
                onClick={generateNew}
                disabled={isRefreshing}
                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate new code"
                aria-label="Generate new captcha"
              >
                <RefreshCcw className={`h-4 w-4 transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={userInput.length !== 5 || isRefreshing}
              className="w-full h-10 rounded-lg bg-white/90 text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white active:bg-white/80 transition-all duration-200"
            >
              Verify
            </button>

            {error ? (
              <p className="text-xs text-red-400 flex items-center gap-1.5 animate-fade-in">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {error}
              </p>
            ) : (
              <p className="text-xs text-white/30">
                Type the 5 characters shown above
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
