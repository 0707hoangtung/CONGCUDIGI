/**
 * Advanced Math Parsing and Function Analysis Engine
 * Supports:
 * - Polynomials of degree n (bậc n)
 * - General rational functions (phân thức tổng quát P(x)/Q(x))
 * - Radical functions (chứa căn thức sqrt, cbrt)
 * - Trigonometric functions (lượng giác sin, cos, tan, cot) with Pi formatting
 * - Exponential functions (hàm mũ e^x, a^x)
 * - Logarithmic functions (hàm logarit ln, log)
 * - Absolute value, powers, and arbitrary mathematical expressions
 */

export interface BBTPoint {
  xTex: string;
  yPrime?: "0" | "||" | "";
  isDiscontinuity?: boolean;
  yTex?: string;
  yLevel?: "top" | "mid" | "bottom";
  yLabel?: "CĐ" | "CT" | "Đỉnh" | "";
  leftLimit?: { tex: string; level: "top" | "mid" | "bottom" };
  rightLimit?: { tex: string; level: "top" | "mid" | "bottom" };
}

export interface BBTSegment {
  sign: "+" | "-" | "";
  trend: "up" | "down" | "none";
  startLevel: "top" | "mid" | "bottom";
  endLevel: "top" | "mid" | "bottom";
  isUndefined?: boolean;
}

export interface BBTData {
  points: BBTPoint[];
  segments: BBTSegment[];
}

export interface BBTColumn {
  x: string;
  yPrime: string; // "+", "-", "0", "||", ""
  y: string;
  yType?: "peak" | "valley" | "mid" | "limit-plus" | "limit-minus" | "asymptote";
  yLeft?: string;
  yRight?: string;
}

export interface FunctionAnalysisResult {
  fnType: "quadratic" | "cubic" | "biquadratic" | "rational11" | "rational21" | "general";
  domain: string;
  domainExplanation?: string;
  domainConditionTex?: string;
  derivativeTex: string;
  derivativeRootsTex: string[];
  extrema: { type: "Cực đại" | "Cực tiểu" | "Đỉnh Parabol"; x: number; y: number; label: string }[];
  symmetryAxis?: string;
  inflectionPoint?: { x: number; y: number; label: string };
  asymptotes?: {
    vertical?: { eq: string; x: number };
    horizontal?: { eq: string; y: number };
    slant?: { eq: string; m: number; c: number };
    intersection?: { x: number; y: number };
  };
  monotonicity: {
    increasing: string[];
    decreasing: string[];
  };
  bbtData?: BBTData;
  bbtColumns: BBTColumn[];
  discontinuities: number[];
  formulaTex: string;
  fn: (x: number) => number;
}

/**
 * Format a number to LaTeX.
 * When isTrig is true or when value is close to a fraction of PI,
 * it formats with \pi (e.g. 2\pi instead of 6.28, \frac{\pi}{2} instead of 1.57, -3\pi/2 instead of -4.71)
 */
export function formatPiOrFrac(val: number, isTrig = false, precision = 2): string {
  if (!Number.isFinite(val)) {
    if (val === Infinity || val > 1e6) return "+\\infty";
    if (val === -Infinity || val < -1e6) return "-\\infty";
    return "—";
  }

  if (Math.abs(val) < 1e-5) return "0";

  // Check integer first (e.g. 1, -1, 2, -2...) so values like 1 or -1 are never misidentified as multiples of PI
  if (Math.abs(val - Math.round(val)) < 1e-4) {
    return String(Math.round(val));
  }

  // Check if val is a rational multiple of PI (pi, 2pi, pi/2, 3pi/4, -pi/3, etc.)
  const piVal = Math.PI;
  const ratio = val / piVal;

  // We check denominators up to 12
  const denoms = [1, 2, 3, 4, 6, 8, 12];
  for (const q of denoms) {
    const p = Math.round(ratio * q);
    if (Math.abs(ratio - p / q) < (isTrig ? 0.002 : 0.001) && Math.abs(p) <= 64) {
      const sign = p < 0 ? "-" : "";
      const absP = Math.abs(p);

      if (absP === 0) return "0";

      if (q === 1) {
        if (absP === 1) return `${sign}\\pi`;
        return `${sign}${absP}\\pi`;
      }

      // Simplify gcd(absP, q)
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const g = gcd(absP, q);
      const simpP = absP / g;
      const simpQ = q / g;

      if (simpQ === 1) {
        if (simpP === 1) return `${sign}\\pi`;
        return `${sign}${simpP}\\pi`;
      }
      if (simpP === 1) {
        return `${sign}\\frac{\\pi}{${simpQ}}`;
      }
      return `${sign}\\frac{${simpP}\\pi}{${simpQ}}`;
    }
  }

  // Check common radical fractions for trig functions: sqrt(2)/2, sqrt(3)/2, sqrt(3), 1/sqrt(3)
  if (isTrig) {
    const sqrt2_2 = Math.SQRT2 / 2;
    const sqrt3_2 = Math.sqrt(3) / 2;
    const sqrt3 = Math.sqrt(3);
    const inv_sqrt3 = 1 / Math.sqrt(3);

    if (Math.abs(Math.abs(val) - sqrt2_2) < 0.008) {
      return val < 0 ? "-\\frac{\\sqrt{2}}{2}" : "\\frac{\\sqrt{2}}{2}";
    }
    if (Math.abs(Math.abs(val) - sqrt3_2) < 0.008) {
      return val < 0 ? "-\\frac{\\sqrt{3}}{2}" : "\\frac{\\sqrt{3}}{2}";
    }
    if (Math.abs(Math.abs(val) - sqrt3) < 0.008) {
      return val < 0 ? "-\\sqrt{3}" : "\\sqrt{3}";
    }
    if (Math.abs(Math.abs(val) - inv_sqrt3) < 0.008) {
      return val < 0 ? "-\\frac{\\sqrt{3}}{3}" : "\\frac{\\sqrt{3}}{3}";
    }
  }

  // Check standard rational fraction p/q
  for (let q = 2; q <= 24; q++) {
    const p = Math.round(val * q);
    if (Math.abs(val - p / q) < 1e-4) {
      const sign = p < 0 ? "-" : "";
      return `${sign}\\frac{${Math.abs(p)}}{${q}}`;
    }
  }

  // Fallback decimal
  const rounded = Number(val.toFixed(precision));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(precision);
}

/**
 * Clean and normalize LaTeX and plain text math expressions into standard JS math tokens
 */
export function normalizeMathExpression(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let s = raw.trim();

  // Strip leading y = or f(x) =
  s = s.replace(/^(?:y|f\(x\)|g\(x\))\s*=\s*/i, "");

  // Convert LaTeX fractions \frac{num}{den} or \dfrac{num}{den} recursively
  while (/\\(?:d)?frac\s*\{/.test(s)) {
    s = s.replace(/\\(?:d)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(( $1 ) / ( $2 ))");
  }

  // Convert roots \sqrt[n]{x} and \sqrt{x}
  while (/\\sqrt\s*\[([^[\]]+)\]\s*\{([^{}]+)\}/.test(s)) {
    s = s.replace(/\\sqrt\s*\[([^[\]]+)\]\s*\{([^{}]+)\}/g, "pow($2, 1/($1))");
  }
  while (/\\sqrt\s*\{([^{}]+)\}/.test(s)) {
    s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)");
  }

  // Handle log with custom base: \log_{base}(arg) or \log_base(arg) or \log_base x
  // e.g. \log_2(x), \log_{0.5}(x), \log_{1/2}(x), \log_{2}x
  s = s.replace(/\\?log_(?:\{([^{}]+)\}|([a-zA-Z0-9_./+\-*]+))\s*(?:\(([^()]+)\)|([a-zA-Z0-9_]+))/gi, (m, b1, b2, a1, a2) => {
    const base = (b1 || b2).trim();
    const arg = (a1 || a2).trim();
    return `(ln(${arg})/ln(${base}))`;
  });

  // Handle log with 2 arguments: log(base, x)
  s = s.replace(/\\?log\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "(ln($2)/ln($1))");

  // LaTeX function names
  s = s.replace(/\\sin\b/g, "sin");
  s = s.replace(/\\cos\b/g, "cos");
  s = s.replace(/\\tan\b/g, "tan");
  s = s.replace(/\\cot\b/g, "cot");
  s = s.replace(/\\ln\b/g, "ln");
  s = s.replace(/\\lg\b/g, "log");
  s = s.replace(/\\log\b/g, "log");
  s = s.replace(/\\exp\b/g, "exp");
  s = s.replace(/\\pi\b/g, "PI");
  s = s.replace(/\bpi\b/gi, "PI");
  s = s.replace(/\\cdot/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\left|\\right/g, "");

  // Functions without parens: ln x -> ln(x), log x -> log(x), sin x -> sin(x), etc.
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\s+([xX]|\d+(?:\.\d+)?)\b/g, "$1($2)");

  // Replace remaining { } with ( )
  s = s.replace(/\{/g, "(").replace(/\}/g, ")");

  // Handle trig & log powers: sin^2(x) -> (sin(x))^2, ln^2(x) -> (ln(x))^2
  s = s.replace(/(sin|cos|tan|cot|ln|log)\^(\d+)\s*\(([^()]+)\)/gi, "(($1($3))^$2)");
  s = s.replace(/(sin|cos|tan|cot|ln|log)\^(\d+)\s*x/gi, "(($1(x))^$2)");

  // Handle e^... -> (E^(...))
  s = s.replace(/\be\^(\([^()]+\))/gi, "(E^$1)");
  s = s.replace(/\be\^([a-zA-Z0-9_]+)/gi, "(E^($1))");

  // Implicit multiplication:
  // 1. number before variable or func: 2x -> 2*x, 3sin -> 3*sin, 4( -> 4*(
  s = s.replace(/(\d+(?:\.\d+)?)\s*([a-zA-Z(])/g, "$1*$2");

  // 2. x before func or paren: x( -> x*(, x sin -> x*sin, x sqrt -> x*sqrt
  s = s.replace(/([xX])\s*([a-zA-Z(])/g, (m, p1, p2) => {
    if (p2.toLowerCase() === "p" && m.toLowerCase().includes("pi")) return m;
    return `${p1}*${p2}`;
  });

  // 3. ) before variable, number or paren: )( -> )*(, )x -> )*x, )2 -> )*2
  s = s.replace(/\)\s*([a-zA-Z0-9_(])/g, ")*$1");

  return s;
}

/**
 * Fast AST / Tokenizer based evaluator for f(x)
 */
export function compileMathFunction(exprStr: string): ((x: number) => number) | null {
  const norm = normalizeMathExpression(exprStr);
  if (!norm) return null;

  try {
    let jsCode = norm
      .replace(/\^/g, "**")
      .replace(/\bPI\b/g, "Math.PI")
      .replace(/\bE\b/g, "Math.E")
      .replace(/\bsin\s*\(/gi, "Math.sin(")
      .replace(/\bcos\s*\(/gi, "Math.cos(")
      .replace(/\btan\s*\(/gi, "Math.tan(")
      .replace(/\bcot\s*\(([^()]+)\)/gi, "(Math.cos($1)/Math.sin($1))")
      .replace(/\basin\s*\(/gi, "Math.asin(")
      .replace(/\bacos\s*\(/gi, "Math.acos(")
      .replace(/\batan\s*\(/gi, "Math.atan(")
      .replace(/\bsqrt\s*\(/gi, "Math.sqrt(")
      .replace(/\bcbrt\s*\(/gi, "Math.cbrt(")
      .replace(/\bln\s*\(/gi, "__MLOGE__(")
      .replace(/\blog\s*\(/gi, "__MLOG10__(")
      .replace(/__MLOGE__\(/g, "Math.log(")
      .replace(/__MLOG10__\(/g, "Math.log10(")
      .replace(/\bexp\s*\(/gi, "Math.exp(")
      .replace(/\babs\s*\(/gi, "Math.abs(")
      .replace(/\bpow\s*\(/gi, "Math.pow(");

    // Create function runner
    const fn = new Function(
      "x",
      `"use strict";
       try {
         const res = (${jsCode});
         if (typeof res !== "number" || isNaN(res)) return NaN;
         if (res > 1e8) return 1e8;
         if (res < -1e8) return -1e8;
         return res;
       } catch(e) {
         return NaN;
       }`
    ) as (x: number) => number;

    // Test run on a sample of values covering different valid domains
    const testPoints = [0.1, 0.5, 1, 2, 3, 5, 0, -1, -2, Math.PI / 4, Math.PI / 2];
    const hasAnyValid = testPoints.some((xVal) => Number.isFinite(fn(xVal)));
    if (!hasAnyValid) {
      return null;
    }

    return fn;
  } catch (err) {
    return null;
  }
}

/**
 * Numerical derivative f'(x)
 */
export function numericalDerivative(fn: (x: number) => number, x: number, h = 1e-5): number {
  const yPlus = fn(x + h);
  const yMinus = fn(x - h);
  if (Number.isFinite(yPlus) && Number.isFinite(yMinus)) {
    return (yPlus - yMinus) / (2 * h);
  }
  if (Number.isFinite(yPlus)) {
    const y0 = fn(x);
    if (Number.isFinite(y0)) return (yPlus - y0) / h;
  }
  if (Number.isFinite(yMinus)) {
    const y0 = fn(x);
    if (Number.isFinite(y0)) return (y0 - yMinus) / h;
  }
  return NaN;
}

/**
 * Numerical second derivative f''(x)
 */
export function numericalSecondDerivative(fn: (x: number) => number, x: number, h = 1e-4): number {
  const yPlus = fn(x + h);
  const y0 = fn(x);
  const yMinus = fn(x - h);
  if (Number.isFinite(yPlus) && Number.isFinite(y0) && Number.isFinite(yMinus)) {
    return (yPlus - 2 * y0 + yMinus) / (h * h);
  }
  return NaN;
}

/**
 * Generate a clean LaTeX string for the derivative of common functions
 */
function getSymbolicDerivativeLatex(rawExpr: string): { tex: string; rootsTexHint?: string[] } {
  const clean = rawExpr.replace(/\s+/g, "").replace(/^(?:y|f\(x\))=/, "");

  // 1. Trig: sin(x) -> cos(x)
  if (/^\\?sin\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "\\cos(x)",
      rootsTexHint: [
        "x = -\\frac{3\\pi}{2}",
        "x = -\\frac{\\pi}{2}",
        "x = \\frac{\\pi}{2}",
        "x = \\frac{3\\pi}{2}",
        "x = \\frac{\\pi}{2} + k\\pi \\ (k \\in \\mathbb{Z})",
      ],
    };
  }
  if (/^\\?cos\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "-\\sin(x)",
      rootsTexHint: [
        "x = -2\\pi",
        "x = -\\pi",
        "x = 0",
        "x = \\pi",
        "x = 2\\pi",
        "x = k\\pi \\ (k \\in \\mathbb{Z})",
      ],
    };
  }
  if (/^\\?tan\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "1 + \\tan^2(x) = \\frac{1}{\\cos^2(x)} > 0",
      rootsTexHint: [],
    };
  }
  if (/^\\?cot\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "-(1 + \\cot^2(x)) = -\\frac{1}{\\sin^2(x)} < 0",
      rootsTexHint: [],
    };
  }

  // 2. Exponential: e^x, a^x, e^{-x^2}, etc.
  if (/^e\^\{?x\}?$/i.test(clean) || /^\\exp\(x\)$/i.test(clean)) {
    return {
      tex: "e^x > 0 \\quad (\\forall x \\in \\mathbb{R})",
      rootsTexHint: [],
    };
  }
  if (/^e\^\{?-x\}?$/i.test(clean)) {
    return {
      tex: "-e^{-x} < 0 \\quad (\\forall x \\in \\mathbb{R})",
      rootsTexHint: [],
    };
  }
  if (/^e\^\{?-x\^2\}?$/i.test(clean)) {
    return {
      tex: "-2x \\cdot e^{-x^2}",
      rootsTexHint: ["x = 0"],
    };
  }
  if (/^x\s*\*?\s*e\^\{?x\}?$/i.test(clean)) {
    return {
      tex: "(x + 1)e^x",
      rootsTexHint: ["x = -1"],
    };
  }
  // a^x (e.g. 2^x, 3^x, 10^x)
  const mExpA = clean.match(/^(\d+(?:\.\d+)?)\^\{?x\}?$/i);
  if (mExpA) {
    const a = parseFloat(mExpA[1]);
    if (a > 1) {
      return {
        tex: `${a}^x \\ln(${a}) > 0 \\quad (\\forall x \\in \\mathbb{R})`,
        rootsTexHint: [],
      };
    } else if (a > 0 && a < 1) {
      return {
        tex: `${a}^x \\ln(${a}) < 0 \\quad (\\forall x \\in \\mathbb{R})`,
        rootsTexHint: [],
      };
    }
  }
  // (1/2)^x or (frac{1}{2})^x
  if (/\((?:1\/2|\\frac\{1\}\{2\})\)\^\{?x\}?|0\.5\^\{?x\}?/i.test(clean)) {
    return {
      tex: "\\left(\\frac{1}{2}\\right)^x \\ln\\left(\\frac{1}{2}\\right) = -\\left(\\frac{1}{2}\\right)^x \\ln(2) < 0 \\quad (\\forall x \\in \\mathbb{R})",
      rootsTexHint: [],
    };
  }

  // 3. Logarithm: ln(x), log_a(x), log(x)
  if (/^\\?ln\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "\\frac{1}{x} > 0 \\quad (\\forall x > 0)",
      rootsTexHint: [],
    };
  }
  if (/^\\?log\s*\(?\s*x\s*\)?$/i.test(clean) || /^\\?lg\s*\(?\s*x\s*\)?$/i.test(clean)) {
    return {
      tex: "\\frac{1}{x \\ln(10)} > 0 \\quad (\\forall x > 0)",
      rootsTexHint: [],
    };
  }
  // log_a(x)
  const mLogBase = clean.match(/^\\?log_(?:\{([^{}]+)\}|([a-zA-Z0-9_./+\-*]+))\s*\(?\s*x\s*\)?$/i);
  if (mLogBase) {
    const baseStr = (mLogBase[1] || mLogBase[2]).trim();
    const baseNum = parseFloat(baseStr.replace(/\\frac\{1\}\{2\}|1\/2/g, "0.5"));
    if (baseNum === 2) {
      return {
        tex: "\\frac{1}{x \\ln(2)} > 0 \\quad (\\forall x > 0)",
        rootsTexHint: [],
      };
    } else if (baseNum === 0.5 || baseStr.includes("1/2") || baseStr.includes("\\frac{1}{2}")) {
      return {
        tex: "-\\frac{1}{x \\ln(2)} < 0 \\quad (\\forall x > 0)",
        rootsTexHint: [],
      };
    } else if (Number.isFinite(baseNum)) {
      const signStr = baseNum > 1 ? "> 0" : "< 0";
      return {
        tex: `\\frac{1}{x \\ln(${baseStr})} ${signStr} \\quad (\\forall x > 0)`,
        rootsTexHint: [],
      };
    }
  }
  if (/^\\?ln\s*\(?\s*x\^2\s*\+\s*1\s*\)?$/i.test(clean)) {
    return {
      tex: "\\frac{2x}{x^2 + 1}",
      rootsTexHint: ["x = 0"],
    };
  }
  if (/^\\?ln\s*\(?\s*4\s*-\s*x\^2\s*\)?$/i.test(clean)) {
    return {
      tex: "-\\frac{2x}{4 - x^2}",
      rootsTexHint: ["x = 0"],
    };
  }

  // 4. Radical: sqrt(x), sqrt(x^2-4), sqrt(4-x^2)
  if (/^\\?sqrt\s*\{?\s*x\s*\}?$/i.test(clean)) {
    return {
      tex: "\\frac{1}{2\\sqrt{x}} > 0 \\quad (\\forall x > 0)",
      rootsTexHint: [],
    };
  }
  if (/^\\?sqrt\s*\{?\s*4\s*-\s*x\^2\s*\}?$/i.test(clean)) {
    return {
      tex: "-\\frac{x}{\\sqrt{4 - x^2}}",
      rootsTexHint: ["x = 0"],
    };
  }
  if (/^\\?sqrt\s*\{?\s*x\^2\s*-\s*4\s*\}?$/i.test(clean)) {
    return {
      tex: "\\frac{x}{\\sqrt{x^2 - 4}}",
      rootsTexHint: [],
    };
  }

  // 5. Rational: 1/(x^2+1), (x^2-1)/(x^2+1), 1/(x^2-4)
  if (/^\\?(?:d)?frac\{1\}\{x\^2-4\}$|^1\/\(x\^2-4\)$/i.test(clean)) {
    return {
      tex: "-\\frac{2x}{(x^2 - 4)^2}",
      rootsTexHint: ["x = 0"],
    };
  }
  if (/^\\?(?:d)?frac\{1\}\{x\^2\+1\}$|^1\/\(x\^2\+1\)$/i.test(clean)) {
    return {
      tex: "-\\frac{2x}{(x^2 + 1)^2}",
      rootsTexHint: ["x = 0"],
    };
  }
  if (/^\\?(?:d)?frac\{x\^2-1\}\{x\^2\+1\}$|^\(x\^2-1\)\/\(x\^2\+1\)$/i.test(clean)) {
    return {
      tex: "\\frac{4x}{(x^2 + 1)^2}",
      rootsTexHint: ["x = 0"],
    };
  }

  // 6. Polynomial of degree n: e.g. x^5 - 5x + 1
  if (/^x\^5-5x(\+\d+)?$/i.test(clean)) {
    return {
      tex: "5x^4 - 5 = 5(x^2 - 1)(x^2 + 1)",
      rootsTexHint: ["x = -1", "x = 1"],
    };
  }

  // General fallback
  const displayFormula = rawExpr
    .replace(/^y\s*=\s*/i, "")
    .replace(/^f\(x\)\s*=\s*/i, "");
  return {
    tex: `\\frac{d}{dx}\\left[ ${displayFormula} \\right]`,
  };
}

export interface DomainResult {
  domainTex: string;
  conditionTex: string;
  explanation: string;
  type:
    | "entire_R"
    | "bounded_closed"
    | "bounded_open"
    | "unbounded_right_closed"
    | "unbounded_right_open"
    | "unbounded_left_closed"
    | "two_unbounded_closed"
    | "R_minus_points"
    | "trig_tan"
    | "trig_cot";
  intervals: { min: number; max: number; includeMin: boolean; includeMax: boolean }[];
  boundaryPoints: { x: number; isClosed: boolean }[];
  discontinuities: number[];
  isInsideDomain: (x: number) => boolean;
}

/**
 * Mathematically rigorous domain solver.
 * Identifies exact conditions, domain interval bounds, poles, and boundary points.
 */
export function determineFunctionDomain(rawExpr: string, fn: (x: number) => number): DomainResult {
  const clean = rawExpr.replace(/\s+/g, "").replace(/^(?:y|f\(x\))=/, "");
  const low = clean.toLowerCase();

  // 1. Trig: tan(x), cot(x)
  if (/tan|\\tan/.test(low)) {
    return {
      domainTex: "D = \\mathbb{R} \\setminus \\left\\{ \\frac{\\pi}{2} + k\\pi, \\, k \\in \\mathbb{Z} \\right\\}",
      conditionTex: "\\cos(x) \\neq 0 \\iff x \\neq \\frac{\\pi}{2} + k\\pi \\quad (k \\in \\mathbb{Z})",
      explanation: "Hàm số tan(x) xác định khi cos(x) khác 0 (trên khoảng khảo sát [-\\pi; \\pi] không xác định tại x = -\\pi/2 và x = \\pi/2)",
      type: "trig_tan",
      intervals: [
        { min: -Math.PI, max: -0.5 * Math.PI, includeMin: true, includeMax: false },
        { min: -0.5 * Math.PI, max: 0.5 * Math.PI, includeMin: false, includeMax: false },
        { min: 0.5 * Math.PI, max: Math.PI, includeMin: false, includeMax: true },
      ],
      boundaryPoints: [
        { x: -Math.PI, isClosed: true },
        { x: Math.PI, isClosed: true },
      ],
      discontinuities: [-0.5 * Math.PI, 0.5 * Math.PI],
      isInsideDomain: (x) => Math.abs(Math.cos(x)) > 1e-4,
    };
  }

  if (/cot|\\cot/.test(low)) {
    return {
      domainTex: "D = \\mathbb{R} \\setminus \\{ k\\pi, \\, k \\in \\mathbb{Z} \\}",
      conditionTex: "\\sin(x) \\neq 0 \\iff x \\neq k\\pi \\quad (k \\in \\mathbb{Z})",
      explanation: "Hàm số cot(x) xác định khi sin(x) khác 0 (trên khoảng khảo sát [-\\pi; \\pi] không xác định tại x = -\\pi, x = 0, x = \\pi)",
      type: "trig_cot",
      intervals: [
        { min: -Math.PI, max: 0, includeMin: false, includeMax: false },
        { min: 0, max: Math.PI, includeMin: false, includeMax: false },
      ],
      boundaryPoints: [],
      discontinuities: [-Math.PI, 0, Math.PI],
      isInsideDomain: (x) => Math.abs(Math.sin(x)) > 1e-4,
    };
  }

  // 2. Radicals (Căn bậc hai): \sqrt{g(x)}
  const sqrtMatch = clean.match(/\\sqrt\{([^{}]+)\}|\\sqrt\(([^()]+)\)|sqrt\(([^()]+)\)/i);
  if (sqrtMatch) {
    const radStr = (sqrtMatch[1] || sqrtMatch[2] || sqrtMatch[3]).trim();
    // Case 2a: a - x^2 (e.g. 4 - x^2, 9 - x^2, 1 - x^2)
    const mConstMinusX2 = radStr.match(/^(\d+(?:\.\d+)?)\s*-\s*x(?:\^2)?$/i);
    if (mConstMinusX2) {
      const a = parseFloat(mConstMinusX2[1]);
      const r = Math.sqrt(a);
      const rStr = formatPiOrFrac(r);
      const minusRStr = formatPiOrFrac(-r);
      return {
        domainTex: `D = [${minusRStr}; ${rStr}]`,
        conditionTex: `${a} - x^2 \\ge 0 \\iff x^2 \\le ${a} \\iff ${minusRStr} \\le x \\le ${rStr}`,
        explanation: `Biểu thức dưới dấu căn không âm: ${a} - x^2 >= 0`,
        type: "bounded_closed",
        intervals: [{ min: -r, max: r, includeMin: true, includeMax: true }],
        boundaryPoints: [{ x: -r, isClosed: true }, { x: r, isClosed: true }],
        discontinuities: [],
        isInsideDomain: (x) => x >= -r - 1e-5 && x <= r + 1e-5,
      };
    }

    // Case 2b: x^2 - a (e.g. x^2 - 4, x^2 - 1, x^2 - 9)
    const mX2MinusConst = radStr.match(/^x(?:\^2)?\s*-\s*(\d+(?:\.\d+)?)$/i);
    if (mX2MinusConst) {
      const a = parseFloat(mX2MinusConst[1]);
      const r = Math.sqrt(a);
      const rStr = formatPiOrFrac(r);
      const minusRStr = formatPiOrFrac(-r);
      return {
        domainTex: `D = (-\\infty; ${minusRStr}] \\cup [${rStr}; +\\infty)`,
        conditionTex: `x^2 - ${a} \\ge 0 \\iff x \\le ${minusRStr} \\lor x \\ge ${rStr}`,
        explanation: `Biểu thức dưới dấu căn không âm: x^2 - ${a} >= 0`,
        type: "two_unbounded_closed",
        intervals: [
          { min: -Infinity, max: -r, includeMin: false, includeMax: true },
          { min: r, max: Infinity, includeMin: true, includeMax: false },
        ],
        boundaryPoints: [{ x: -r, isClosed: true }, { x: r, isClosed: true }],
        discontinuities: [],
        isInsideDomain: (x) => x <= -r + 1e-5 || x >= r - 1e-5,
      };
    }

    // Case 2c: x alone (e.g. \sqrt{x})
    if (/^x$/i.test(radStr)) {
      return {
        domainTex: "D = [0; +\\infty)",
        conditionTex: "x \\ge 0",
        explanation: "Biểu thức dưới dấu căn không âm: x >= 0",
        type: "unbounded_right_closed",
        intervals: [{ min: 0, max: Infinity, includeMin: true, includeMax: false }],
        boundaryPoints: [{ x: 0, isClosed: true }],
        discontinuities: [],
        isInsideDomain: (x) => x >= -1e-5,
      };
    }

    // Case 2d: x + c
    const mXPlusConst = radStr.match(/^x\s*([+-])\s*(\d+(?:\.\d+)?)$/i);
    if (mXPlusConst) {
      const sign = mXPlusConst[1];
      const val = parseFloat(mXPlusConst[2]);
      const root = sign === "+" ? -val : val;
      const rootStr = formatPiOrFrac(root);
      return {
        domainTex: `D = [${rootStr}; +\\infty)`,
        conditionTex: `${radStr} \\ge 0 \\iff x \\ge ${rootStr}`,
        explanation: `Biểu thức dưới dấu căn không âm: ${radStr} >= 0`,
        type: "unbounded_right_closed",
        intervals: [{ min: root, max: Infinity, includeMin: true, includeMax: false }],
        boundaryPoints: [{ x: root, isClosed: true }],
        discontinuities: [],
        isInsideDomain: (x) => x >= root - 1e-5,
      };
    }

    // Case 2e: General linear ax + b
    const mGenLinearRad = radStr.match(/^([+-]?\d*(?:\.\d+)?)x\s*([+-]\s*\d+(?:\.\d+)?)$/i);
    if (mGenLinearRad) {
      const rawA = mGenLinearRad[1];
      const a = rawA === "" || rawA === "+" ? 1 : rawA === "-" ? -1 : parseFloat(rawA);
      const b = parseFloat(mGenLinearRad[2].replace(/\s+/g, ""));
      const root = -b / a;
      const rootStr = formatPiOrFrac(root);
      if (a > 0) {
        return {
          domainTex: `D = [${rootStr}; +\\infty)`,
          conditionTex: `${radStr} \\ge 0 \\iff x \\ge ${rootStr}`,
          explanation: `Biểu thức dưới dấu căn không âm: ${radStr} >= 0`,
          type: "unbounded_right_closed",
          intervals: [{ min: root, max: Infinity, includeMin: true, includeMax: false }],
          boundaryPoints: [{ x: root, isClosed: true }],
          discontinuities: [],
          isInsideDomain: (x) => x >= root - 1e-5,
        };
      } else {
        return {
          domainTex: `D = (-\\infty; ${rootStr}]`,
          conditionTex: `${radStr} \\ge 0 \\iff x \\le ${rootStr}`,
          explanation: `Biểu thức dưới dấu căn không âm: ${radStr} >= 0`,
          type: "unbounded_left_closed",
          intervals: [{ min: -Infinity, max: root, includeMin: false, includeMax: true }],
          boundaryPoints: [{ x: root, isClosed: true }],
          discontinuities: [],
          isInsideDomain: (x) => x <= root + 1e-5,
        };
      }
    }

    // Case 2f: c - x
    const mConstMinusX = radStr.match(/^(\d+(?:\.\d+)?)\s*-\s*x$/i);
    if (mConstMinusX) {
      const val = parseFloat(mConstMinusX[1]);
      const rootStr = formatPiOrFrac(val);
      return {
        domainTex: `D = (-\\infty; ${rootStr}]`,
        conditionTex: `${val} - x \\ge 0 \\iff x \\le ${rootStr}`,
        explanation: `Biểu thức dưới dấu căn không âm: ${val} - x >= 0`,
        type: "unbounded_left_closed",
        intervals: [{ min: -Infinity, max: val, includeMin: false, includeMax: true }],
        boundaryPoints: [{ x: val, isClosed: true }],
        discontinuities: [],
        isInsideDomain: (x) => x <= val + 1e-5,
      };
    }
  }

  // 3. Logarithms: ln(g(x)), log(g(x)), lg(g(x)), \log_a(g(x))
  const logMatch =
    clean.match(/\\?(?:ln|log|lg)(?:_\{?([^{}()_]+)\}?)?\s*(?:\(([^()]+)\)|([a-zA-Z0-9^.+\-*]+))/i) ||
    clean.match(/log\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
  if (logMatch) {
    let baseStr = "";
    let argStr = "";
    if (logMatch[0].startsWith("log(") && logMatch[0].includes(",")) {
      baseStr = logMatch[1].trim();
      argStr = logMatch[2].trim();
    } else {
      baseStr = (logMatch[1] || "").trim();
      argStr = (logMatch[2] || logMatch[3] || "").trim();
    }
    if (!argStr) argStr = "x";

    const baseNote = baseStr ? ` cơ số ${baseStr}` : "";

    if (/^x$/i.test(argStr)) {
      return {
        domainTex: "D = (0; +\\infty)",
        conditionTex: "x > 0",
        explanation: `Biểu thức trong dấu logarit${baseNote} phải dương: x > 0 (đường thẳng x = 0 là tiệm cận đứng)`,
        type: "unbounded_right_open",
        intervals: [{ min: 0, max: Infinity, includeMin: false, includeMax: false }],
        boundaryPoints: [{ x: 0, isClosed: false }],
        discontinuities: [0],
        isInsideDomain: (x) => x > 1e-5,
      };
    }

    // ln(x + c) or ln(x - c)
    const mLogLinear = argStr.match(/^x\s*([+-]\s*\d+(?:\.\d+)?)$/i);
    if (mLogLinear) {
      const c = parseFloat(mLogLinear[1].replace(/\s+/g, ""));
      const root = -c;
      const rootStr = formatPiOrFrac(root);
      return {
        domainTex: `D = (${rootStr}; +\\infty)`,
        conditionTex: `${argStr} > 0 \\iff x > ${rootStr}`,
        explanation: `Biểu thức trong dấu logarit${baseNote} phải dương: ${argStr} > 0`,
        type: "unbounded_right_open",
        intervals: [{ min: root, max: Infinity, includeMin: false, includeMax: false }],
        boundaryPoints: [{ x: root, isClosed: false }],
        discontinuities: [root],
        isInsideDomain: (x) => x > root + 1e-5,
      };
    }

    // ln(x^2 + c) with c > 0
    const mX2PlusC = argStr.match(/^x(?:\^2)?\s*\+\s*(\d+(?:\.\d+)?)$/i);
    if (mX2PlusC) {
      const c = parseFloat(mX2PlusC[1]);
      if (c > 0) {
        return {
          domainTex: "D = \\mathbb{R}",
          conditionTex: `x^2 + ${c} > 0 \\quad (\\forall x \\in \\mathbb{R})`,
          explanation: `Biểu thức x^2 + ${c} luôn dương với mọi số thực x`,
          type: "entire_R",
          intervals: [{ min: -Infinity, max: Infinity, includeMin: false, includeMax: false }],
          boundaryPoints: [],
          discontinuities: [],
          isInsideDomain: () => true,
        };
      }
    }

    // ln(a - x^2)
    const mConstMinusX2 = argStr.match(/^(\d+(?:\.\d+)?)\s*-\s*x(?:\^2)?$/i);
    if (mConstMinusX2) {
      const a = parseFloat(mConstMinusX2[1]);
      const r = Math.sqrt(a);
      const rStr = formatPiOrFrac(r);
      const minusRStr = formatPiOrFrac(-r);
      return {
        domainTex: `D = (${minusRStr}; ${rStr})`,
        conditionTex: `${a} - x^2 > 0 \\iff ${minusRStr} < x < ${rStr}`,
        explanation: `Biểu thức trong logarit${baseNote} phải dương: ${a} - x^2 > 0`,
        type: "bounded_open",
        intervals: [{ min: -r, max: r, includeMin: false, includeMax: false }],
        boundaryPoints: [{ x: -r, isClosed: false }, { x: r, isClosed: false }],
        discontinuities: [-r, r],
        isInsideDomain: (x) => x > -r + 1e-5 && x < r - 1e-5,
      };
    }
  }

  // 3b. Exponential functions: e^x, a^x, e^{-x^2}, etc.
  if (
    /^(?:e\^|\\exp\(|\d+(?:\.\d+)?\^|\((?:1\/2|\\frac\{1\}\{2\})\)\^)/i.test(clean) &&
    !clean.includes("/") &&
    !clean.includes("\\frac")
  ) {
    return {
      domainTex: "D = \\mathbb{R}",
      conditionTex: "\\forall x \\in \\mathbb{R}",
      explanation: "Hàm số mũ luôn xác định với mọi giá trị của biến số x thuộc R",
      type: "entire_R",
      intervals: [{ min: -Infinity, max: Infinity, includeMin: false, includeMax: false }],
      boundaryPoints: [],
      discontinuities: [],
      isInsideDomain: () => true,
    };
  }

  // 4. Rational Fractions: P(x)/Q(x)
  const fracMatch = clean.match(/\\(?:d)?frac\{([^{}]+)\}\{([^{}]+)\}/) || clean.match(/^\(?([^/()]+)\)?\/\(?([^/()]+)\)?$/);
  if (fracMatch) {
    const denStr = fracMatch[2].trim();

    // 4.0 Monomial power denominator: x, x^2, x^3, etc.
    if (/^x(?:\^\d+)?$/i.test(denStr)) {
      return {
        domainTex: "D = \\mathbb{R} \\setminus \\{0\\}",
        conditionTex: `${denStr} \\neq 0 \\iff x \\neq 0`,
        explanation: `Điều kiện mẫu số khác 0: ${denStr} khác 0`,
        type: "R_minus_points",
        intervals: [
          { min: -Infinity, max: 0, includeMin: false, includeMax: false },
          { min: 0, max: Infinity, includeMin: false, includeMax: false },
        ],
        boundaryPoints: [],
        discontinuities: [0],
        isInsideDomain: (x) => Math.abs(x) > 1e-4,
      };
    }

    // 4a. Quadratic denominator x^2 + c (c > 0) -> Delta < 0, D = R
    const mX2PlusConst = denStr.match(/^x(?:\^2)?\s*\+\s*(\d+(?:\.\d+)?)$/i);
    if (mX2PlusConst) {
      const c = parseFloat(mX2PlusConst[1]);
      if (c > 0) {
        return {
          domainTex: "D = \\mathbb{R}",
          conditionTex: `x^2 + ${c} > 0 \\quad (\\forall x \\in \\mathbb{R})`,
          explanation: `Mẫu số x^2 + ${c} luôn dương với mọi số thực x (vô nghiệm trên R)`,
          type: "entire_R",
          intervals: [{ min: -Infinity, max: Infinity, includeMin: false, includeMax: false }],
          boundaryPoints: [],
          discontinuities: [],
          isInsideDomain: () => true,
        };
      }
    }

    // 4b. Quadratic denominator x^2 - a (a > 0) -> roots +-sqrt(a)
    const mX2MinusConst = denStr.match(/^x(?:\^2)?\s*-\s*(\d+(?:\.\d+)?)$/i);
    if (mX2MinusConst) {
      const a = parseFloat(mX2MinusConst[1]);
      const r = Math.sqrt(a);
      const rStr = formatPiOrFrac(r);
      const minusRStr = formatPiOrFrac(-r);
      return {
        domainTex: `D = \\mathbb{R} \\setminus \\{${minusRStr}; ${rStr}\\}`,
        conditionTex: `x^2 - ${a} \\neq 0 \\iff x \\neq ${minusRStr} \\land x \\neq ${rStr}`,
        explanation: `Mẫu số phải khác 0: x^2 - ${a} khác 0`,
        type: "R_minus_points",
        intervals: [
          { min: -Infinity, max: -r, includeMin: false, includeMax: false },
          { min: -r, max: r, includeMin: false, includeMax: false },
          { min: r, max: Infinity, includeMin: false, includeMax: false },
        ],
        boundaryPoints: [],
        discontinuities: [-r, r],
        isInsideDomain: (x) => Math.abs(x - (-r)) > 1e-4 && Math.abs(x - r) > 1e-4,
      };
    }

    // 4c. General quadratic: ax^2 + bx + c
    const mQuad = denStr.match(/^([+-]?\d*(?:\.\d+)?)x\^2([+-]\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)$/i)
      || denStr.match(/^([+-]?\d*(?:\.\d+)?)x\^2([+-]\d+(?:\.\d+)?)$/i);
    if (mQuad) {
      let a = 1;
      let b = 0;
      let c = 0;
      if (mQuad[3] !== undefined) {
        const rawA = mQuad[1];
        a = rawA === "" || rawA === "+" ? 1 : rawA === "-" ? -1 : parseFloat(rawA);
        const rawB = mQuad[2];
        b = rawB === "+" ? 1 : rawB === "-" ? -1 : parseFloat(rawB);
        c = parseFloat(mQuad[3]);
      } else {
        const rawA = mQuad[1];
        a = rawA === "" || rawA === "+" ? 1 : rawA === "-" ? -1 : parseFloat(rawA);
        c = parseFloat(mQuad[2]);
      }
      const delta = b * b - 4 * a * c;
      if (delta < -1e-6) {
        return {
          domainTex: "D = \\mathbb{R}",
          conditionTex: `${denStr} \\neq 0 \\quad (\\Delta < 0, \\, \\forall x \\in \\mathbb{R})`,
          explanation: `Mẫu số vô nghiệm trên R (biệt thức Delta < 0)`,
          type: "entire_R",
          intervals: [{ min: -Infinity, max: Infinity, includeMin: false, includeMax: false }],
          boundaryPoints: [],
          discontinuities: [],
          isInsideDomain: () => true,
        };
      } else if (Math.abs(delta) <= 1e-6) {
        const x0 = -b / (2 * a);
        const x0Str = formatPiOrFrac(x0);
        return {
          domainTex: `D = \\mathbb{R} \\setminus \\{${x0Str}\\}`,
          conditionTex: `${denStr} \\neq 0 \\iff x \\neq ${x0Str}`,
          explanation: `Mẫu số có nghiệm kép: x = ${x0Str}`,
          type: "R_minus_points",
          intervals: [
            { min: -Infinity, max: x0, includeMin: false, includeMax: false },
            { min: x0, max: Infinity, includeMin: false, includeMax: false },
          ],
          boundaryPoints: [],
          discontinuities: [x0],
          isInsideDomain: (x) => Math.abs(x - x0) > 1e-4,
        };
      } else {
        const sqrtDelta = Math.sqrt(delta);
        const x1 = (-b - sqrtDelta) / (2 * a);
        const x2 = (-b + sqrtDelta) / (2 * a);
        const r1 = Math.min(x1, x2);
        const r2 = Math.max(x1, x2);
        const r1Str = formatPiOrFrac(r1);
        const r2Str = formatPiOrFrac(r2);
        return {
          domainTex: `D = \\mathbb{R} \\setminus \\{${r1Str}; ${r2Str}\\}`,
          conditionTex: `${denStr} \\neq 0 \\iff x \\neq ${r1Str} \\land x \\neq ${r2Str}`,
          explanation: `Mẫu số có 2 nghiệm phân biệt: x = ${r1Str}, x = ${r2Str}`,
          type: "R_minus_points",
          intervals: [
            { min: -Infinity, max: r1, includeMin: false, includeMax: false },
            { min: r1, max: r2, includeMin: false, includeMax: false },
            { min: r2, max: Infinity, includeMin: false, includeMax: false },
          ],
          boundaryPoints: [],
          discontinuities: [r1, r2],
          isInsideDomain: (x) => Math.abs(x - r1) > 1e-4 && Math.abs(x - r2) > 1e-4,
        };
      }
    }

    // 4d. Linear denominator cx + d
    const mLinear = denStr.match(/^([+-]?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?$/i) || denStr.match(/^x$/i);
    if (mLinear) {
      let c = 1;
      let d = 0;
      if (denStr.toLowerCase() === "x") {
        c = 1;
        d = 0;
      } else {
        const rawC = mLinear[1];
        c = rawC === "" || rawC === "+" ? 1 : rawC === "-" ? -1 : parseFloat(rawC);
        d = mLinear[2] ? parseFloat(mLinear[2]) : 0;
      }
      const pole = -d / c;
      const poleStr = formatPiOrFrac(pole);
      return {
        domainTex: `D = \\mathbb{R} \\setminus \\{${poleStr}\\}`,
        conditionTex: `${denStr} \\neq 0 \\iff x \\neq ${poleStr}`,
        explanation: `Điều kiện mẫu số khác 0: ${denStr} khác 0`,
        type: "R_minus_points",
        intervals: [
          { min: -Infinity, max: pole, includeMin: false, includeMax: false },
          { min: pole, max: Infinity, includeMin: false, includeMax: false },
        ],
        boundaryPoints: [],
        discontinuities: [pole],
        isInsideDomain: (x) => Math.abs(x - pole) > 1e-4,
      };
    }
  }

  // 5. Default: Entire R (Polynomials, Exponentials, sin, cos)
  return {
    domainTex: "D = \\mathbb{R}",
    conditionTex: "\\forall x \\in \\mathbb{R}",
    explanation: "Hàm số xác định trên toàn bộ tập số thực R",
    type: "entire_R",
    intervals: [{ min: -Infinity, max: Infinity, includeMin: false, includeMax: false }],
    boundaryPoints: [],
    discontinuities: [],
    isInsideDomain: () => true,
  };
}

/**
 * Universal Function Analyzer for Any Mathematical Expression:
 * Supports polynomials of degree n, general rationals, radicals,
 * trigonometric functions (with exact Pi formatting), exponentials, and logarithms.
 */
export function analyzeGeneralFunction(rawExpr: string): FunctionAnalysisResult | null {
  const fn = compileMathFunction(rawExpr);
  if (!fn) return null;

  const low = rawExpr.toLowerCase();
  const isTrig = /sin|cos|tan|cot|\\pi|\bpi\b/.test(low);
  const isLog = /\bln\b|\blog\b/.test(low);

  // 1. Determine exact domain and mathematical conditions
  const domainRes = determineFunctionDomain(rawExpr, fn);
  const fnType: "general" = "general";
  const domain = domainRes.domainTex;
  const domainExplanation = domainRes.explanation;
  const domainConditionTex = domainRes.conditionTex;
  const discontinuities = domainRes.discontinuities;

  // 2. Critical Points Search (f'(x) = 0) strictly inside the interior of valid domain intervals
  interface RawCriticalPoint {
    x: number;
    y: number;
    d2: number;
  }
  const rawCritPoints: RawCriticalPoint[] = [];

  // Check canonical trig multiples if function is trigonometric
  if (isTrig) {
    const canonicalMultiples = [
      -2 * Math.PI,
      -1.75 * Math.PI,
      -1.5 * Math.PI,
      -1.333333 * Math.PI,
      -1.25 * Math.PI,
      -Math.PI,
      -0.75 * Math.PI,
      -0.666667 * Math.PI,
      -0.5 * Math.PI,
      -0.333333 * Math.PI,
      -0.25 * Math.PI,
      0,
      0.25 * Math.PI,
      0.333333 * Math.PI,
      0.5 * Math.PI,
      0.666667 * Math.PI,
      0.75 * Math.PI,
      Math.PI,
      1.25 * Math.PI,
      1.333333 * Math.PI,
      1.5 * Math.PI,
      1.75 * Math.PI,
      2 * Math.PI,
    ];

    for (const cx of canonicalMultiples) {
      if (!domainRes.isInsideDomain(cx)) continue;
      if (discontinuities.some((d) => Math.abs(d - cx) < 0.05)) continue;
      const d1 = numericalDerivative(fn, cx);
      if (Number.isFinite(d1) && Math.abs(d1) < 0.02) {
        const yVal = fn(cx);
        if (Number.isFinite(yVal) && Math.abs(yVal) < 100) {
          const d2 = numericalSecondDerivative(fn, cx);
          if (Math.abs(d2) > 0.05) {
            rawCritPoints.push({ x: cx, y: yVal, d2 });
          }
        }
      }
    }
  }

  // Scan across domain intervals
  for (const intv of domainRes.intervals) {
    let scanStart = -8;
    let scanEnd = 8;
    let step = 0.04;

    if (isTrig) {
      scanStart = Math.max(-2 * Math.PI, intv.min);
      scanEnd = Math.min(2 * Math.PI, intv.max);
      step = Math.PI / 48;
    } else {
      if (Number.isFinite(intv.min)) {
        scanStart = intv.includeMin ? intv.min + 0.05 : intv.min + 0.1;
      }
      if (Number.isFinite(intv.max)) {
        scanEnd = intv.includeMax ? intv.max - 0.05 : intv.max - 0.1;
      }
      if (Number.isFinite(intv.min) && Number.isFinite(intv.max)) {
        step = Math.max(0.01, (scanEnd - scanStart) / 100);
      }
    }

    if (scanEnd <= scanStart) continue;

    let prevX = scanStart;
    let prevD1 = numericalDerivative(fn, prevX);

    for (let x = scanStart + step; x <= scanEnd; x += step) {
      if (discontinuities.some((d) => Math.abs(d - x) < step * 1.5)) {
        prevX = x;
        prevD1 = NaN;
        continue;
      }

      const currD1 = numericalDerivative(fn, x);

      if (Number.isFinite(prevD1) && Number.isFinite(currD1)) {
        if (prevD1 * currD1 <= 0 || Math.abs(currD1) < 1e-4) {
          // Bisection to refine critical point with correct fLeft tracking
          let left = prevX;
          let right = x;
          let rootX = (left + right) / 2;
          let fLeft = prevD1;

          for (let iter = 0; iter < 24; iter++) {
            const mid = (left + right) / 2;
            const midD1 = numericalDerivative(fn, mid);
            if (!Number.isFinite(midD1)) break;
            rootX = mid;
            if (Math.abs(midD1) < 1e-7) break;
            if (fLeft * midD1 <= 0) {
              right = mid;
            } else {
              left = mid;
              fLeft = midD1;
            }
          }

          const yVal = fn(rootX);
          if (Number.isFinite(yVal) && Math.abs(yVal) < 200) {
            const d2 = numericalSecondDerivative(fn, rootX);
            const already = rawCritPoints.some((p) => Math.abs(p.x - rootX) < (isTrig ? 0.2 : 0.08));
            if (!already) {
              rawCritPoints.push({ x: rootX, y: yVal, d2 });
            }
          }
        }
      }

      prevX = x;
      prevD1 = currD1;
    }
  }

  // Sort critical points
  rawCritPoints.sort((a, b) => a.x - b.x);

  // Classify extrema using rigorous First Derivative Test
  const extrema: { type: "Cực đại" | "Cực tiểu" | "Đỉnh Parabol"; x: number; y: number; label: string }[] = [];
  const derivativeRootsTex: string[] = [];

  for (let i = 0; i < rawCritPoints.length; i++) {
    const pt = rawCritPoints[i];
    const eps = isTrig ? 0.05 : 0.02;
    const dLeft = numericalDerivative(fn, pt.x - eps);
    const dRight = numericalDerivative(fn, pt.x + eps);

    let type: "Cực đại" | "Cực tiểu" | null = null;
    if (Number.isFinite(dLeft) && Number.isFinite(dRight)) {
      if (dLeft > 1e-5 && dRight < -1e-5) {
        type = "Cực đại";
      } else if (dLeft < -1e-5 && dRight > 1e-5) {
        type = "Cực tiểu";
      }
    }

    if (!type) {
      if (pt.d2 < -1e-4) type = "Cực đại";
      else if (pt.d2 > 1e-4) type = "Cực tiểu";
      else {
        const yLeft = fn(pt.x - eps);
        const yRight = fn(pt.x + eps);
        if (Number.isFinite(yLeft) && Number.isFinite(yRight)) {
          if (pt.y > yLeft && pt.y > yRight) type = "Cực đại";
          else if (pt.y < yLeft && pt.y < yRight) type = "Cực tiểu";
        }
      }
    }

    if (!type) continue; // Stationary inflection point - not an extremum

    const xTex = formatPiOrFrac(pt.x, isTrig);
    const yTex = formatPiOrFrac(pt.y, isTrig);
    const letter = type === "Cực đại" ? "CĐ" : "CT";

    extrema.push({
      type,
      x: pt.x,
      y: pt.y,
      label: `${letter}(${xTex}; ${yTex})`,
    });

    derivativeRootsTex.push(`x = ${xTex}`);
  }

  // Inflection point / Center of symmetry
  let inflectionPoint: { x: number; y: number; label: string } | undefined = undefined;
  if (rawCritPoints.length === 2) {
    const midX = (rawCritPoints[0].x + rawCritPoints[1].x) / 2;
    const midY = fn(midX);
    if (Number.isFinite(midY)) {
      inflectionPoint = {
        x: midX,
        y: midY,
        label: `I(${formatPiOrFrac(midX, isTrig)}; ${formatPiOrFrac(midY, isTrig)})`,
      };
    }
  }

  // 3. Asymptotes detection
  const asymptotes: FunctionAnalysisResult["asymptotes"] = {};
  if (discontinuities.length > 0) {
    const mainPole = discontinuities[0];
    asymptotes.vertical = {
      eq: `x = ${formatPiOrFrac(mainPole, isTrig)}`,
      x: mainPole,
    };
  }

  // Independent left and right limits at infinity
  const hasLeftInfDomain = domainRes.intervals.some((inv) => !Number.isFinite(inv.min));
  const hasRightInfDomain = domainRes.intervals.some((inv) => !Number.isFinite(inv.max));

  let yLeftLimVal: number | null = null;
  if (hasLeftInfDomain) {
    const yM1 = fn(-150);
    const yM2 = fn(-300);
    if (Number.isFinite(yM1) && Number.isFinite(yM2) && Math.abs(yM1 - yM2) < 0.05 && Math.abs(yM1) < 500) {
      yLeftLimVal = yM1;
    }
  }

  let yRightLimVal: number | null = null;
  if (hasRightInfDomain) {
    const yP1 = fn(150);
    const yP2 = fn(300);
    if (Number.isFinite(yP1) && Number.isFinite(yP2) && Math.abs(yP1 - yP2) < 0.05 && Math.abs(yP1) < 500) {
      yRightLimVal = yP1;
    }
  }

  if (yLeftLimVal !== null && yRightLimVal !== null && Math.abs(yLeftLimVal - yRightLimVal) < 0.05) {
    asymptotes.horizontal = {
      eq: `y = ${formatPiOrFrac(yRightLimVal, isTrig)}`,
      y: yRightLimVal,
    };
  } else if (yLeftLimVal !== null && yRightLimVal === null) {
    asymptotes.horizontal = {
      eq: `y = ${formatPiOrFrac(yLeftLimVal, isTrig)}`,
      y: yLeftLimVal,
    };
  } else if (yRightLimVal !== null && yLeftLimVal === null) {
    asymptotes.horizontal = {
      eq: `y = ${formatPiOrFrac(yRightLimVal, isTrig)}`,
      y: yRightLimVal,
    };
  }

  // 4. Unified Mathematical Variation Table (BBT) Engine
  // Collect all critical partition nodes on the x-axis:
  interface XPartitionNode {
    xVal: number;
    kind: "infinity_left" | "infinity_right" | "boundary" | "discontinuity" | "extremum" | "stationary";
    extremumType?: "Cực đại" | "Cực tiểu" | "Đỉnh Parabol";
  }
  const allNodes: XPartitionNode[] = [];

  // Infinite / trig boundary endpoints
  if (isTrig) {
    allNodes.push({ xVal: -Math.PI, kind: "boundary" });
    allNodes.push({ xVal: Math.PI, kind: "boundary" });
  } else {
    allNodes.push({ xVal: -Infinity, kind: "infinity_left" });
    allNodes.push({ xVal: Infinity, kind: "infinity_right" });
  }

  // Domain boundary points
  for (const bp of domainRes.boundaryPoints) {
    if (isTrig && Math.abs(bp.x) > Math.PI + 0.01) continue;
    allNodes.push({ xVal: bp.x, kind: "boundary" });
  }

  // Discontinuities (poles)
  for (const disc of discontinuities) {
    if (isTrig && Math.abs(disc) > Math.PI + 0.01) continue;
    allNodes.push({ xVal: disc, kind: "discontinuity" });
  }

  // Extrema
  for (const ex of extrema) {
    if (isTrig && Math.abs(ex.x) > Math.PI + 0.01) continue;
    allNodes.push({ xVal: ex.x, kind: "extremum", extremumType: ex.type });
  }

  // Stationary points without extremum (e.g. inflection point where f'(x)=0)
  for (const rpt of rawCritPoints) {
    if (isTrig && Math.abs(rpt.x) > Math.PI + 0.01) continue;
    if (!allNodes.some((n) => Math.abs(n.xVal - rpt.x) < 0.05)) {
      allNodes.push({ xVal: rpt.x, kind: "stationary" });
    }
  }

  // Sort nodes ascending by xVal
  allNodes.sort((a, b) => a.xVal - b.xVal);

  // Filter deduplicated nodes
  const dedupNodes: XPartitionNode[] = [];
  for (const n of allNodes) {
    const existing = dedupNodes.find((d) => Math.abs(d.xVal - n.xVal) < 0.04);
    if (!existing) {
      dedupNodes.push(n);
    } else {
      // Prioritize discontinuity or boundary over extremum if too close
      if (n.kind === "discontinuity" || n.kind === "boundary") {
        existing.kind = n.kind;
      }
    }
  }

  const bbtPoints: BBTPoint[] = [];
  const bbtColumns: BBTColumn[] = [];
  const bbtSegments: BBTSegment[] = [];
  const increasing: string[] = [];
  const decreasing: string[] = [];

  for (let i = 0; i < dedupNodes.length; i++) {
    const node = dedupNodes[i];

    if (node.kind === "infinity_left") {
      let yTex = "";
      let yLevel: "top" | "mid" | "bottom" = "bottom";
      if (hasLeftInfDomain) {
        if (yLeftLimVal !== null) {
          yTex = formatPiOrFrac(yLeftLimVal, isTrig);
          yLevel = Math.abs(yLeftLimVal) < 0.01 ? "bottom" : "mid";
        } else {
          const farVal = fn(-150);
          const isPlus = farVal > 0;
          yTex = isPlus ? "+\\infty" : "-\\infty";
          yLevel = isPlus ? "top" : "bottom";
        }
      }
      bbtPoints.push({ xTex: "-\\infty", yPrime: "", yTex, yLevel });
      bbtColumns.push({ x: "-\\infty", yPrime: "", y: yTex, yType: yLevel === "top" ? "limit-plus" : "limit-minus" });
    } else if (node.kind === "infinity_right") {
      let yTex = "";
      let yLevel: "top" | "mid" | "bottom" = "bottom";
      if (hasRightInfDomain) {
        if (yRightLimVal !== null) {
          yTex = formatPiOrFrac(yRightLimVal, isTrig);
          yLevel = Math.abs(yRightLimVal) < 0.01 ? "bottom" : "mid";
        } else {
          const farVal = fn(150);
          const isPlus = farVal > 0;
          yTex = isPlus ? "+\\infty" : "-\\infty";
          yLevel = isPlus ? "top" : "bottom";
        }
      }
      bbtPoints.push({ xTex: "+\\infty", yPrime: "", yTex, yLevel });
      bbtColumns.push({ x: "+\\infty", yPrime: "", y: yTex, yType: yLevel === "top" ? "limit-plus" : "limit-minus" });
    } else if (node.kind === "discontinuity") {
      const xTex = formatPiOrFrac(node.xVal, isTrig);
      const leftInDomain = domainRes.isInsideDomain(node.xVal - 0.05);
      const rightInDomain = domainRes.isInsideDomain(node.xVal + 0.05);

      let leftTex = "";
      let leftLevel: "top" | "bottom" = "bottom";
      if (leftInDomain) {
        const yL = fn(node.xVal - 1e-4);
        const isPlus = yL > 0;
        leftTex = isPlus ? "+\\infty" : "-\\infty";
        leftLevel = isPlus ? "top" : "bottom";
      }

      let rightTex = "";
      let rightLevel: "top" | "bottom" = "bottom";
      if (rightInDomain) {
        const yR = fn(node.xVal + 1e-4);
        const isPlus = yR > 0;
        rightTex = isPlus ? "+\\infty" : "-\\infty";
        rightLevel = isPlus ? "top" : "bottom";
      }

      bbtPoints.push({
        xTex,
        yPrime: "||",
        isDiscontinuity: true,
        leftLimit: leftTex ? { tex: leftTex, level: leftLevel } : undefined,
        rightLimit: rightTex ? { tex: rightTex, level: rightLevel } : undefined,
      });

      bbtColumns.push({
        x: xTex,
        yPrime: "||",
        y: "",
        yType: "asymptote",
        yLeft: leftTex,
        yRight: rightTex,
      });
    } else if (node.kind === "boundary") {
      const xTex = formatPiOrFrac(node.xVal, isTrig);
      const yVal = fn(node.xVal);
      const yTex = Number.isFinite(yVal) ? formatPiOrFrac(yVal, isTrig) : "";
      const isDefined = Number.isFinite(yVal) && domainRes.isInsideDomain(node.xVal);
      const yPrime = isDefined && isTrig ? "" : "||";

      let yLevel: "top" | "mid" | "bottom" = "mid";
      if (!Number.isFinite(yVal)) {
        yLevel = "bottom";
      } else if (Math.abs(yVal - 1) < 0.05) {
        yLevel = "top";
      } else if (Math.abs(yVal - (-1)) < 0.05) {
        yLevel = "bottom";
      } else if (Math.abs(yVal) < 0.05) {
        yLevel = "mid";
      } else if (yVal > 0.5) {
        yLevel = "top";
      } else if (yVal < -0.5) {
        yLevel = "bottom";
      }

      bbtPoints.push({
        xTex,
        yPrime,
        yTex,
        yLevel,
      });
      bbtColumns.push({
        x: xTex,
        yPrime,
        y: yTex,
        yType: yLevel === "bottom" ? "valley" : yLevel === "top" ? "peak" : "mid",
      });
    } else {
      // Extremum or stationary point
      const xTex = formatPiOrFrac(node.xVal, isTrig);
      const yVal = fn(node.xVal);
      const yTex = Number.isFinite(yVal) ? formatPiOrFrac(yVal, isTrig) : "";

      if (node.kind === "extremum") {
        const isCD = node.extremumType === "Cực đại";
        const yLevel: "top" | "bottom" = isCD ? "top" : "bottom";
        const yLabel: "CĐ" | "CT" = isCD ? "CĐ" : "CT";

        bbtPoints.push({
          xTex,
          yPrime: "0",
          yTex,
          yLevel,
          yLabel,
        });
        bbtColumns.push({
          x: xTex,
          yPrime: "0",
          y: yTex,
          yType: isCD ? "peak" : "valley",
        });
      } else {
        // Stationary inflection point
        bbtPoints.push({
          xTex,
          yPrime: "0",
          yTex,
          yLevel: "mid",
        });
        bbtColumns.push({
          x: xTex,
          yPrime: "0",
          y: yTex,
          yType: "mid",
        });
      }
    }
  }

  // Generate segments between adjacent partition nodes
  for (let i = 0; i < dedupNodes.length - 1; i++) {
    const n1 = dedupNodes[i];
    const n2 = dedupNodes[i + 1];

    let midX = 0;
    if (!Number.isFinite(n1.xVal) && !Number.isFinite(n2.xVal)) {
      midX = 0;
    } else if (!Number.isFinite(n1.xVal)) {
      midX = n2.xVal - (isTrig ? 0.5 : 1.5);
    } else if (!Number.isFinite(n2.xVal)) {
      midX = n1.xVal + (isTrig ? 0.5 : 1.5);
    } else {
      midX = (n1.xVal + n2.xVal) / 2;
    }

    const isInside = domainRes.isInsideDomain(midX);

    if (!isInside) {
      bbtSegments.push({
        sign: "",
        trend: "none",
        startLevel: "mid",
        endLevel: "mid",
        isUndefined: true,
      });
    } else {
      let d1 = numericalDerivative(fn, midX);
      if (!Number.isFinite(d1)) {
        d1 = fn(midX + 0.05) - fn(midX - 0.05);
      }
      const isUp = d1 >= 0;
      const sign: "+" | "-" = isUp ? "+" : "-";
      const trend: "up" | "down" = isUp ? "up" : "down";

      let startLevel: "top" | "mid" | "bottom" = bbtPoints[i].isDiscontinuity
        ? (bbtPoints[i].rightLimit?.level || (isUp ? "bottom" : "top"))
        : (bbtPoints[i].yLevel || (isUp ? "bottom" : "top"));

      let endLevel: "top" | "mid" | "bottom" = bbtPoints[i + 1].isDiscontinuity
        ? (bbtPoints[i + 1].leftLimit?.level || (isUp ? "top" : "bottom"))
        : (bbtPoints[i + 1].yLevel || (isUp ? "top" : "bottom"));

      // Harmonize geometric elevations with trend
      if (isUp) {
        if (startLevel === "top") startLevel = "mid";
        if (endLevel === "bottom") endLevel = "mid";
        if (startLevel === endLevel) {
          startLevel = "bottom";
          endLevel = "top";
        }
      } else {
        if (startLevel === "bottom") startLevel = "mid";
        if (endLevel === "top") endLevel = "mid";
        if (startLevel === endLevel) {
          startLevel = "top";
          endLevel = "bottom";
        }
      }

      bbtSegments.push({
        sign,
        trend,
        startLevel,
        endLevel,
      });

      const intvStr = `(${bbtPoints[i].xTex}; ${bbtPoints[i + 1].xTex})`;
      if (isUp) {
        increasing.push(intvStr);
      } else {
        decreasing.push(intvStr);
      }
    }
  }

  const bbtData: BBTData = {
    points: bbtPoints,
    segments: bbtSegments,
  };

  const symbDeriv = getSymbolicDerivativeLatex(rawExpr);
  const derivativeTex = symbDeriv.tex;
  const finalDerivRootsTex = symbDeriv.rootsTexHint && symbDeriv.rootsTexHint.length > 0
    ? symbDeriv.rootsTexHint
    : derivativeRootsTex;

  return {
    fnType,
    domain,
    domainExplanation,
    domainConditionTex,
    derivativeTex,
    derivativeRootsTex: finalDerivRootsTex,
    extrema,
    inflectionPoint,
    asymptotes,
    monotonicity: {
      increasing,
      decreasing,
    },
    bbtData,
    bbtColumns,
    discontinuities,
    formulaTex: rawExpr,
    fn,
  };
}
