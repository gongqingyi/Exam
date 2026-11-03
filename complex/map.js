(() => {
const { compile, evaluate, formatComplex } = window.ComplexMap;

const TEMPLATES = [
  {
    id: "square",
    name: "平方",
    expr: "z^2",
    note: "竖线、横线都变成抛物线。",
    params: {}
  },
  {
    id: "power",
    name: "幂函数",
    expr: "z^n",
    note: "n = 2 就是平方。n 增大时，角度被乘上 n。",
    params: { n: { re: 3, im: 0, min: -2, max: 6, step: 0.1 } }
  },
  {
    id: "exp",
    name: "指数",
    expr: "exp(a*z)",
    note: "竖线变成圆，横线变成射线。",
    params: { a: { re: 1, im: 0, min: -1.2, max: 1.2, step: 0.01 } }
  },
  {
    id: "log",
    name: "对数",
    expr: "log(z)",
    note: "主值支。负实轴两侧会断开。",
    params: {}
  },
  {
    id: "sqrt",
    name: "平方根",
    expr: "sqrt(z)",
    note: "把平面折成右半平面，负实轴是支割线。",
    params: {}
  },
  {
    id: "inv",
    name: "倒数",
    expr: "a/z",
    note: "圆内翻到圆外，原点是极点。",
    params: { a: { re: 1, im: 0 } }
  },
  {
    id: "inversion",
    name: "反演",
    expr: "b + a/conj(z-b)",
    note: "对以 b 为圆心的圆作反演。a 取正实数时是半径的平方；a = 1、b = 0 就是单位圆。圆仍映成圆，角度反向。",
    params: {
      a: { re: 1, im: 0, min: 0.25, max: 2.5, step: 0.01 },
      b: { re: 0, im: 0, min: -1.2, max: 1.2, step: 0.01 }
    }
  },
  {
    id: "joukowski",
    name: "儒科夫斯基",
    expr: "z + a/z",
    note: "单位圆映成一条线段。a = 1 时线段是 −2 到 2。",
    params: { a: { re: 1, im: 0, min: 0.2, max: 2, step: 0.01 } }
  },
  {
    id: "sin",
    name: "正弦",
    expr: "sin(a*z)",
    note: "把竖线映成椭圆，把横线映成双曲线。",
    params: { a: { re: 1, im: 0 } }
  },
  {
    id: "cos",
    name: "余弦",
    expr: "cos(a*z)",
    note: "和正弦相差一个平移。",
    params: { a: { re: 1, im: 0 } }
  },
  {
    id: "mobius",
    name: "分式线性",
    expr: "(a*z + b)/(c*z + d)",
    note: "把圆和直线仍映成圆或直线。",
    params: {
      a: { re: 1, im: 0 },
      b: { re: -1, im: 0 },
      c: { re: 1, im: 0 },
      d: { re: 1, im: 0 }
    }
  },
  {
    id: "quadratic",
    name: "二次多项式",
    expr: "a*z^2 + b*z + c",
    note: "改 a、b、c 就是在平移、旋转这个平方映射。",
    params: {
      a: { re: 1, im: 0 },
      b: { re: 0, im: 0 },
      c: { re: 0, im: 0 }
    }
  },
  {
    id: "rotate",
    name: "旋转",
    expr: "exp(i*t)*z",
    note: "绕原点旋转。t 是转角，单位是弧度；t = 1.5708 约为 90°。",
    params: { t: { re: 1.5708, im: 0, min: -3.14, max: 3.14, step: 0.01 } }
  },
  {
    id: "real-linear",
    name: "实线性",
    expr: "a*z + b*conj(z) + c",
    note: "一般实线性变换 w = αz + βz̄ + γ。b 对应 β，不为 0 时不保角，圆会变成椭圆。",
    params: {
      a: { re: 1, im: 0 },
      b: { re: 0.5, im: 0 },
      c: { re: 0, im: 0 }
    }
  },
  {
    id: "projective",
    name: "射影",
    expr: "(a*re(z) + b*im(z) + c + i*(d*re(z) + k*im(z) + f)) / (g*re(z) + h*im(z) + 1)",
    note: "透视（射影）变换。x、y 是 z 的实部、虚部：x′ = (a x + b y + c) / (g x + h y + 1)，y′ = (d x + k y + f) / (g x + h y + 1)。直线仍映成直线，平行线可以相交；圆一般变成圆锥曲线。g、h 控制透视的强弱。",
    params: {
      a: { re: 1, im: 0, min: -2, max: 2, step: 0.01, real: true },
      b: { re: 0, im: 0, min: -1.5, max: 1.5, step: 0.01, real: true },
      c: { re: 0, im: 0, min: -1.5, max: 1.5, step: 0.01, real: true },
      d: { re: 0, im: 0, min: -1.5, max: 1.5, step: 0.01, real: true },
      k: { re: 1, im: 0, min: -2, max: 2, step: 0.01, real: true },
      f: { re: 0, im: 0, min: -1.5, max: 1.5, step: 0.01, real: true },
      g: { re: 0.15, im: 0, min: -0.35, max: 0.35, step: 0.01, real: true },
      h: { re: 0.1, im: 0, min: -0.35, max: 0.35, step: 0.01, real: true }
    }
  },
  {
    id: "linear",
    name: "线性",
    expr: "a*z + b",
    note: "a 的辐角是旋转，模长是伸缩，b 是平移。",
    params: {
      a: { re: 0, im: 1 },
      b: { re: 0.4, im: 0 }
    }
  }
];

const srcCanvas = document.querySelector("#src");
const dstCanvas = document.querySelector("#dst");
const formulaEl = document.querySelector("#formula");
const templateBox = document.querySelector("#templates");
const paramBox = document.querySelector("#params");
const resetParamsBtn = document.querySelector("#reset-params");
const noteEl = document.querySelector("#note");
const statusEl = document.querySelector("#status");
const readoutEl = document.querySelector("#readout");
const domainFields = {
  re0: document.querySelector("#re0"),
  re1: document.querySelector("#re1"),
  im0: document.querySelector("#im0"),
  im1: document.querySelector("#im1"),
  step: document.querySelector("#step")
};
const autoFitEl = document.querySelector("#autofit");

const GRID_V = "#0e6a38";
const GRID_H = "#d12626";
const CIRCLE_C = "#2457d6";
const ANGLE_C = "#7c3aed";

let params = {};
let paramDefaults = {};
let activeTemplate = "";
let compiled = null;
let probe = { re: 1, im: 0.6 };
let circle = { re: 0, im: 0, r: 1 };
let angle = { re: 0.55, im: 0.25, a: Math.PI / 10, b: (7 * Math.PI) / 18 };
let figure = { re: 0.42, im: 1.02 };
let figureGrab = null;
const FIGURE_PARTS = [
  [0, 0, 0.18, 0.86],
  [0, 0.68, 0.56, 0.86],
  [0, 0.34, 0.42, 0.52]
];
const FIGURE_OUTLINE = [
  [0, 0],
  [0.18, 0],
  [0.18, 0.34],
  [0.42, 0.34],
  [0.42, 0.52],
  [0.18, 0.52],
  [0.18, 0.68],
  [0.56, 0.68],
  [0.56, 0.86],
  [0, 0.86]
];
const FIGURE_INK = "#1c2433";
let drag = null;
let hover = null;
let selection = null;
let srcCamera = null;
let srcDomain = null;

function paramValue(name) {
  return params[name] || { re: 1, im: 0 };
}

function readDomain() {
  const re0 = Number(domainFields.re0.value);
  const re1 = Number(domainFields.re1.value);
  const im0 = Number(domainFields.im0.value);
  const im1 = Number(domainFields.im1.value);
  const step = Number(domainFields.step.value);
  if (![re0, re1, im0, im1, step].every(Number.isFinite)) {
    throw new Error("网格范围里有无法读取的数字");
  }
  if (!(re1 > re0) || !(im1 > im0)) throw new Error("范围的右端要大于左端，上端要大于下端");
  if (!(step > 0)) throw new Error("网格间距要是正数");
  return { re0, re1, im0, im1, step };
}

function sliderSpec(value) {
  const real = !!(value && value.real);
  return {
    re: value && Number.isFinite(value.re) ? value.re : 1,
    im: real ? 0 : (value && Number.isFinite(value.im) ? value.im : 0),
    min: value && Number.isFinite(value.min) ? value.min : -2,
    max: value && Number.isFinite(value.max) ? value.max : 2,
    step: value && Number.isFinite(value.step) ? value.step : 0.01,
    real
  };
}

function formatSlider(value, step) {
  const digits = step < 0.1 ? 2 : 1;
  return String(Number(value.toFixed(digits)));
}

function coeff(name) {
  const spec = params[name] || { re: 0, im: 0, step: 0.01, real: false };
  const digits = spec.step < 0.1 ? 2 : 1;
  const re = Number(spec.re.toFixed(digits));
  const im = spec.real ? 0 : Number(spec.im.toFixed(digits));
  return {
    re: Object.is(re, -0) ? 0 : re,
    im: Object.is(im, -0) ? 0 : im
  };
}

function numTex(n) {
  return String(n);
}

function imagUnit(im) {
  if (im === 1) return "i";
  if (im === -1) return "-i";
  return `${numTex(im)}i`;
}

function complexTex(name) {
  const { re, im } = coeff(name);
  if (im === 0) return numTex(re);
  if (re === 0) return imagUnit(im);
  return `${numTex(re)}${im < 0 ? imagUnit(im) : `+${imagUnit(im)}`}`;
}

function isZeroCoeff(name) {
  const { re, im } = coeff(name);
  return re === 0 && im === 0;
}

function parenIfNeeded(tex) {
  if (/^[A-Za-z0-9.]+$/.test(tex) || /^[0-9.]+[A-Za-z]$/.test(tex)) return tex;
  return `(${tex})`;
}

function mulTex(name, factor) {
  const { re, im } = coeff(name);
  if (re === 0 && im === 0) return null;
  if (re === 1 && im === 0) return factor;
  if (re === -1 && im === 0) return `-${factor}`;
  const body = complexTex(name);
  const coeffTex = re !== 0 && im !== 0 ? `(${body})` : body;
  const glue = /[0-9.]$/.test(coeffTex) ? "" : "\\,";
  return `${coeffTex}${glue}${factor}`;
}

function joinSum(parts) {
  const items = parts.filter((part) => part != null && part !== "");
  if (!items.length) return "0";
  let out = items[0];
  for (let i = 1; i < items.length; i += 1) {
    const part = items[i];
    out += part.startsWith("-") ? part : `+${part}`;
  }
  return out;
}

function constantTex(name) {
  if (isZeroCoeff(name)) return null;
  return complexTex(name);
}

function minusCoeff(base, name) {
  if (isZeroCoeff(name)) return base;
  const { re, im } = coeff(name);
  if (im === 0) return re > 0 ? `${base}-${numTex(re)}` : `${base}+${numTex(-re)}`;
  if (re === 0) return im > 0 ? `${base}-${im === 1 ? "i" : `${numTex(im)}i`}` : `${base}+${im === -1 ? "i" : `${numTex(-im)}i`}`;
  return `${base}-(${complexTex(name)})`;
}

function fracTex(num, den) {
  const numerator = num === "0" ? "0" : num;
  const denominator = den === "0" ? "0" : den;
  if (denominator === "1") return numerator;
  return `\\dfrac{${numerator}}{${denominator}}`;
}

function timesI(tex) {
  if (!tex || tex === "0") return null;
  if (tex === "1") return "i";
  if (tex === "-1") return "-i";
  if (/^-?\d+(\.\d+)?$/.test(tex)) {
    return tex.startsWith("-") ? `-${tex.slice(1)}i` : `${tex}i`;
  }
  return `i${parenIfNeeded(tex)}`;
}

function realCombo(pairs, constant) {
  return joinSum([
    ...pairs.map(([name, variable]) => mulTex(name, variable)),
    constant ? constantTex(constant) : null
  ]);
}

function formulaBody() {
  if (activeTemplate === "square") return "z^{2}";
  if (activeTemplate === "power") {
    const { re, im } = coeff("n");
    return im === 0 ? `z^{${numTex(re)}}` : `z^{${complexTex("n")}}`;
  }
  if (activeTemplate === "exp") {
    const inside = mulTex("a", "z") || "0";
    return inside === "0" ? "1" : `e^{${inside}}`;
  }
  if (activeTemplate === "log") return "\\log z";
  if (activeTemplate === "sqrt") return "\\sqrt{z}";
  if (activeTemplate === "inv") return fracTex(parenIfNeeded(complexTex("a")), "z");
  if (activeTemplate === "inversion") {
    const frac = fracTex(parenIfNeeded(complexTex("a")), `\\overline{${minusCoeff("z", "b")}}`);
    return joinSum([constantTex("b"), frac]);
  }
  if (activeTemplate === "joukowski") {
    if (isZeroCoeff("a")) return "z";
    return joinSum(["z", fracTex(parenIfNeeded(complexTex("a")), "z")]);
  }
  if (activeTemplate === "sin") return `\\sin(${mulTex("a", "z") || "0"})`;
  if (activeTemplate === "cos") return `\\cos(${mulTex("a", "z") || "0"})`;
  if (activeTemplate === "mobius") {
    return fracTex(
      joinSum([mulTex("a", "z"), constantTex("b")]),
      joinSum([mulTex("c", "z"), constantTex("d")])
    );
  }
  if (activeTemplate === "quadratic") {
    return joinSum([mulTex("a", "z^{2}"), mulTex("b", "z"), constantTex("c")]);
  }
  if (activeTemplate === "rotate") {
    const { re } = coeff("t");
    if (re === 0) return "z";
    const ex = re === 1 ? "i" : re === -1 ? "-i" : `${numTex(re)}i`;
    return `e^{${ex}}z`;
  }
  if (activeTemplate === "real-linear") {
    return joinSum([mulTex("a", "z"), mulTex("b", "\\overline{z}"), constantTex("c")]);
  }
  if (activeTemplate === "projective") {
    const rePart = realCombo([["a", "x"], ["b", "y"]], "c");
    const num = joinSum([
      rePart === "0" ? null : rePart,
      timesI(realCombo([["d", "x"], ["k", "y"]], "f"))
    ]);
    const den = joinSum([mulTex("g", "x"), mulTex("h", "y"), "1"]);
    const main = fracTex(num === "0" ? "0" : num, den);
    return `${main},\\quad x=\\operatorname{Re}z,\\ y=\\operatorname{Im}z`;
  }
  if (activeTemplate === "linear") return joinSum([mulTex("a", "z"), constantTex("b")]);
  return "z";
}

function renderFormula() {
  const tex = `f(z)=${formulaBody()}`;
  if (window.katex) {
    katex.render(tex, formulaEl, { throwOnError: false, displayMode: true });
  } else {
    formulaEl.textContent = tex;
  }
}

function syncParamsFromTemplate(template) {
  params = {};
  paramDefaults = {};
  for (const [name, value] of Object.entries(template.params)) {
    params[name] = sliderSpec(value);
    paramDefaults[name] = sliderSpec(value);
  }
}

function resetParams() {
  if (!compiled) return;
  for (const name of compiled.symbols) {
    params[name] = sliderSpec(paramDefaults[name] || { re: 1, im: 0 });
  }
  renderParamEditor(compiled.symbols);
  renderFormula();
  draw();
}

function renderParamEditor(symbols) {
  paramBox.replaceChildren();
  if (symbols.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "这个式子没有待定系数。";
    paramBox.append(empty);
    resetParamsBtn.disabled = true;
    return;
  }
  resetParamsBtn.disabled = false;
  for (const name of symbols) {
    params[name] = sliderSpec(params[name]);
    const spec = params[name];
    const box = document.createElement("div");
    box.className = spec.real ? "param real" : "param";
    const title = document.createElement("b");
    title.textContent = name;
    const addSlider = (part, label) => {
      const row = document.createElement("label");
      row.className = "slider";
      const caption = document.createElement("span");
      caption.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      let min = spec.min;
      let max = spec.max;
      if (part === "im") {
        min = Math.min(min, spec.im, 0);
        max = Math.max(max, spec.im, 0);
      }
      input.min = String(min);
      input.max = String(max);
      input.step = String(spec.step);
      const shown = Math.min(max, Math.max(min, spec[part]));
      spec[part] = shown;
      input.value = String(shown);
      input.setAttribute("aria-label", `${name} 的${label}`);
      const readout = document.createElement("span");
      readout.className = "val";
      readout.textContent = formatSlider(shown, spec.step);
      input.addEventListener("input", () => {
        const next = Number(input.value);
        if (!Number.isFinite(next)) return;
        spec[part] = next;
        readout.textContent = formatSlider(next, spec.step);
        renderFormula();
        draw();
      });
      row.append(caption, input, readout);
      return row;
    };
    if (spec.real) {
      spec.im = 0;
      box.append(title, addSlider("re", "值"));
    } else {
      box.append(title, addSlider("re", "实部"), addSlider("im", "虚部"));
    }
    paramBox.append(box);
  }
}

function applyExpression(text, { keepParams = true } = {}) {
  try {
    compiled = compile(text);
    const next = {};
    for (const name of compiled.symbols) {
      if (keepParams && params[name]) {
        next[name] = sliderSpec(params[name]);
      } else {
        const fallback = paramDefaults[name] || { re: 1, im: 0 };
        next[name] = sliderSpec(fallback);
        if (!paramDefaults[name]) paramDefaults[name] = sliderSpec(fallback);
      }
    }
    params = next;
    renderParamEditor(compiled.symbols);
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    renderFormula();
    draw();
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
}

function selectTemplate(id) {
  const template = TEMPLATES.find((item) => item.id === id);
  if (!template) return;
  activeTemplate = id;
  for (const button of templateBox.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.dataset.id === id ? "true" : "false");
  }
  noteEl.textContent = template.note;
  syncParamsFromTemplate(template);
  applyExpression(template.expr, { keepParams: true });
}

function setupTemplates() {
  for (const template of TEMPLATES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = template.id;
    button.textContent = template.name;
    button.addEventListener("click", () => selectTemplate(template.id));
    templateBox.append(button);
  }
}

function values(min, max, step) {
  const start = Math.ceil((min - 1e-9) / step) * step;
  const list = [];
  for (let value = start; value <= max + 1e-9; value += step) {
    const snapped = Math.abs(value) < 1e-10 ? 0 : value;
    list.push(snapped);
    if (list.length > 48) break;
  }
  return list;
}

function mapPolyline(points, fn) {
  const mapped = points.map((point) => {
    try {
      const w = fn(point);
      if (!w || !Number.isFinite(w.re) || !Number.isFinite(w.im)) return null;
      if (Math.hypot(w.re, w.im) > 1e6) return null;
      return w;
    } catch {
      return null;
    }
  });
  const gaps = [];
  for (let i = 1; i < mapped.length; i += 1) {
    const prev = mapped[i - 1];
    const cur = mapped[i];
    if (prev && cur) gaps.push(Math.hypot(cur.re - prev.re, cur.im - prev.im));
  }
  gaps.sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length * 0.6)] : 1;
  const limit = Math.max(typical * 6, 1e-6);
  const runs = [];
  let run = [];
  for (let i = 0; i < mapped.length; i += 1) {
    const cur = mapped[i];
    const prev = run[run.length - 1];
    const jumped = prev && cur && Math.hypot(cur.re - prev.re, cur.im - prev.im) > limit;
    if (!cur || jumped) {
      if (run.length > 1) runs.push(run);
      run = cur && jumped ? [cur] : [];
    } else {
      run.push(cur);
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function sourceGeometry(domain) {
  const vertical = values(domain.re0, domain.re1, domain.step).map((x) => {
    const pts = [];
    const n = 140;
    for (let k = 0; k <= n; k += 1) {
      const y = domain.im0 + (domain.im1 - domain.im0) * (k / n);
      pts.push({ re: x, im: y });
    }
    return { kind: "v", value: x, pts };
  });
  const horizontal = values(domain.im0, domain.im1, domain.step).map((y) => {
    const pts = [];
    const n = 140;
    for (let k = 0; k <= n; k += 1) {
      const x = domain.re0 + (domain.re1 - domain.re0) * (k / n);
      pts.push({ re: x, im: y });
    }
    return { kind: "h", value: y, pts };
  });
  return [...vertical, ...horizontal];
}

function diskPoints(c) {
  const pts = [];
  const n = 180;
  for (let k = 0; k <= n; k += 1) {
    const t = (2 * Math.PI * k) / n;
    pts.push({ re: c.re + c.r * Math.cos(t), im: c.im + c.r * Math.sin(t) });
  }
  return pts;
}

function rayLength(origin, theta, domain) {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (domain.re1 - origin.re) / dx);
  else if (dx < -1e-9) t = Math.min(t, (domain.re0 - origin.re) / dx);
  if (dy > 1e-9) t = Math.min(t, (domain.im1 - origin.im) / dy);
  else if (dy < -1e-9) t = Math.min(t, (domain.im0 - origin.im) / dy);
  if (!Number.isFinite(t) || t < 0.08) return 0.35;
  return t;
}

function rayPoints(origin, theta, domain) {
  const length = rayLength(origin, theta, domain);
  const pts = [];
  const n = 90;
  for (let k = 0; k <= n; k += 1) {
    const t = length * (k / n);
    pts.push({
      re: origin.re + t * Math.cos(theta),
      im: origin.im + t * Math.sin(theta)
    });
  }
  return pts;
}

function foldAngle(a, b) {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

function minorSweep(from, to) {
  let d = to - from;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return d;
}

function imageAngle(fn) {
  const eps = 0.01;
  const z0 = { re: angle.re, im: angle.im };
  const z1 = { re: z0.re + eps * Math.cos(angle.a), im: z0.im + eps * Math.sin(angle.a) };
  const z2 = { re: z0.re + eps * Math.cos(angle.b), im: z0.im + eps * Math.sin(angle.b) };
  const w0 = fn(z0);
  const w1 = fn(z1);
  const w2 = fn(z2);
  if (!w0 || !w1 || !w2) return null;
  if (![w0, w1, w2].every((w) => Number.isFinite(w.re) && Number.isFinite(w.im))) return null;
  const d1 = Math.hypot(w1.re - w0.re, w1.im - w0.im);
  const d2 = Math.hypot(w2.re - w0.re, w2.im - w0.im);
  if (d1 < 1e-6 || d2 < 1e-6) return null;
  const t1 = Math.atan2(w1.im - w0.im, w1.re - w0.re);
  const t2 = Math.atan2(w2.im - w0.im, w2.re - w0.re);
  return { w0, t1, t2, open: foldAngle(t1, t2) };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - index) + sorted[hi] * (index - lo);
}

function boundsOf(runs, fallback) {
  const xs = [];
  const ys = [];
  for (const run of runs) {
    for (const p of run) {
      xs.push(p.re);
      ys.push(p.im);
    }
  }
  if (xs.length < 4) return fallback;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  let x0 = percentile(xs, 0.03);
  let x1 = percentile(xs, 0.97);
  let y0 = percentile(ys, 0.03);
  let y1 = percentile(ys, 0.97);
  if (!(x1 > x0)) {
    x0 -= 1;
    x1 += 1;
  }
  if (!(y1 > y0)) {
    y0 -= 1;
    y1 += 1;
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  return { re0: x0 - 0.08 * dx, re1: x1 + 0.08 * dx, im0: y0 - 0.08 * dy, im1: y1 + 0.08 * dy };
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(280, rect.width);
  const height = Math.max(260, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function camera(width, height, domain) {
  const pad = 36;
  const dx = domain.re1 - domain.re0;
  const dy = domain.im1 - domain.im0;
  const scale = Math.min((width - 2 * pad) / dx, (height - 2 * pad) / dy);
  const ox = (width - dx * scale) / 2 - domain.re0 * scale;
  const oy = (height + dy * scale) / 2 + domain.im0 * scale;
  return {
    scale,
    toScreen(re, im) {
      return [ox + re * scale, oy - im * scale];
    },
    toWorld(x, y) {
      return { re: (x - ox) / scale, im: (oy - y) / scale };
    }
  };
}

function strokeRuns(ctx, cam, runs, color, width, emphasize) {
  const paint = (stroke, lineWidth) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const run of runs) {
      ctx.beginPath();
      run.forEach((p, index) => {
        const [x, y] = cam.toScreen(p.re, p.im);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  };
  if (emphasize) paint("rgba(255,253,248,0.95)", width + 4);
  paint(color, width);
}

function gridKey(kind, value) {
  const snapped = Math.abs(value) < 1e-10 ? 0 : value;
  return `${kind}:${Number(snapped.toFixed(6))}`;
}

function highlightKey(id) {
  if (!id) return null;
  if (id === "radius" || id === "center" || id === "circle") return "circle";
  if (id === "ray1" || id === "ray2") return id;
  if (id.startsWith("v:") || id.startsWith("h:")) return id;
  return null;
}

function isHot(key) {
  return key === selection || key === highlightKey(hover) || key === highlightKey(drag);
}

function niceStep(span) {
  const raw = span / 5;
  if (!(raw > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return nice * pow;
}

function formatTick(value) {
  const v = Math.abs(value) < 1e-8 ? 0 : value;
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return String(Number(v.toFixed(digits)));
}

function drawAxes(ctx, cam, domain, width, height) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(23,50,77,0.38)";
  ctx.fillStyle = "rgba(23,50,77,0.78)";
  ctx.font = "11px Palatino, Songti SC, serif";
  const xStep = niceStep(domain.re1 - domain.re0);
  const yStep = niceStep(domain.im1 - domain.im0);
  const xAxisOn = domain.im0 < 0 && domain.im1 > 0;
  const yAxisOn = domain.re0 < 0 && domain.re1 > 0;
  const [, originY] = cam.toScreen(0, xAxisOn ? 0 : domain.im0);
  const axisY = xAxisOn ? cam.toScreen(0, 0)[1] : Math.min(height - 22, Math.max(18, originY));
  const axisX = yAxisOn ? cam.toScreen(0, 0)[0] : 42;

  ctx.beginPath();
  if (xAxisOn) {
    const [xL] = cam.toScreen(domain.re0, 0);
    const [xR] = cam.toScreen(domain.re1, 0);
    ctx.moveTo(xL, axisY);
    ctx.lineTo(xR, axisY);
  }
  if (yAxisOn) {
    const [, yB] = cam.toScreen(0, domain.im0);
    const [, yT] = cam.toScreen(0, domain.im1);
    ctx.moveTo(axisX, yB);
    ctx.lineTo(axisX, yT);
  }
  ctx.stroke();

  const paint = (text, x, y) => {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#fffdf8";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "rgba(23,50,77,0.88)";
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  ctx.textAlign = "center";
  const xStart = Math.ceil((domain.re0 - 1e-9) / xStep) * xStep;
  const xCount = Math.round((domain.re1 - xStart) / xStep);
  for (let i = 0; i <= xCount; i += 1) {
    const x = xStart + i * xStep;
    const [sx] = cam.toScreen(x, 0);
    if (sx < 26 || sx > width - 16) continue;
    ctx.beginPath();
    ctx.moveTo(sx, axisY - 4);
    ctx.lineTo(sx, axisY + 4);
    ctx.stroke();
    const label = formatTick(x);
    if (label === "0" && yAxisOn) continue;
    const below = axisY + 16 < height - 2;
    ctx.textBaseline = below ? "top" : "bottom";
    paint(label, sx, below ? axisY + 6 : axisY - 6);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yStart = Math.ceil((domain.im0 - 1e-9) / yStep) * yStep;
  const yCount = Math.round((domain.im1 - yStart) / yStep);
  for (let i = 0; i <= yCount; i += 1) {
    const y = yStart + i * yStep;
    const [, sy] = cam.toScreen(0, y);
    if (sy < 12 || sy > height - 14) continue;
    ctx.beginPath();
    ctx.moveTo(axisX - 4, sy);
    ctx.lineTo(axisX + 4, sy);
    ctx.stroke();
    if (formatTick(y) === "0") continue;
    const label = formatTick(y);
    if (axisX > 36) paint(label, axisX - 6, sy);
    else {
      ctx.textAlign = "left";
      paint(label, axisX + 6, sy);
      ctx.textAlign = "right";
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  paint("Re", width - 26, Math.min(height - 8, Math.max(14, axisY - 8)));
  paint("Im", Math.min(width - 24, axisX + 8), 14);
  ctx.restore();
}

function drawMinorArc(ctx, x, y, radius, from, to, color, width) {
  const sweep = minorSweep(from, to);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const steps = 18;
  for (let k = 0; k <= steps; k += 1) {
    const t = from + sweep * (k / steps);
    const px = x + radius * Math.cos(t);
    const py = y - radius * Math.sin(t);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, cam, point, radius) {
  const [cx, cy] = cam.toScreen(point.re, point.im);
  const spikes = 5;
  const inner = radius * 0.4;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? radius : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#e10600";
  ctx.strokeStyle = "#fffdf8";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHandle(ctx, cam, point, fill, radius) {
  const [x, y] = cam.toScreen(point.re, point.im);
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArcAt(ctx, cam, point, from, to, color, width) {
  const [x, y] = cam.toScreen(point.re, point.im);
  drawMinorArc(ctx, x, y, 18, from, to, color, width);
}

function draw() {
  let domain;
  try {
    domain = readDomain();
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
    return;
  }
  if (!compiled) return;
  srcDomain = domain;
  const env = params;
  const fn = (z) => evaluate(compiled.ast, z, env);
  const lines = sourceGeometry(domain);
  const imageRuns = [];
  for (const line of lines) {
    for (const run of mapPolyline(line.pts, fn)) {
      imageRuns.push({ kind: line.kind, key: gridKey(line.kind, line.value), pts: run });
    }
  }
  const circlePts = diskPoints(circle);
  const ray1 = rayPoints(angle, angle.a, domain);
  const ray2 = rayPoints(angle, angle.b, domain);
  const circleRun = mapPolyline(circlePts, fn);
  const ray1Run = mapPolyline(ray1, fn);
  const ray2Run = mapPolyline(ray2, fn);
  const figureImage = figureImageOf(fn);
  const srcView = domain;
  const dstView = autoFitEl.checked
    ? boundsOf([
      ...imageRuns.map((run) => run.pts),
      ...circleRun,
      ...ray1Run,
      ...ray2Run,
      figureImage.points
    ], domain)
    : domain;

  const src = prepareCanvas(srcCanvas);
  const dst = prepareCanvas(dstCanvas);
  const srcCam = camera(src.width, src.height, srcView);
  const dstCam = camera(dst.width, dst.height, dstView);
  srcCamera = srcCam;

  src.ctx.fillStyle = "#fffdf8";
  src.ctx.fillRect(0, 0, src.width, src.height);
  dst.ctx.fillStyle = "#fffdf8";
  dst.ctx.fillRect(0, 0, dst.width, dst.height);

  const paintMarked = (ctx, cam, items, color, base, hotOnly) => {
    for (const item of items) {
      const hot = isHot(item.key);
      if (hot !== hotOnly) continue;
      strokeRuns(ctx, cam, [item.pts], color, hot ? base + 2.4 : base, hot);
    }
  };
  const srcV = lines.filter((line) => line.kind === "v").map((line) => ({ key: gridKey("v", line.value), pts: line.pts }));
  const srcH = lines.filter((line) => line.kind === "h").map((line) => ({ key: gridKey("h", line.value), pts: line.pts }));
  const srcCircle = [{ key: "circle", pts: circlePts }];
  const srcRay1 = [{ key: "ray1", pts: ray1 }];
  const srcRay2 = [{ key: "ray2", pts: ray2 }];
  paintMarked(src.ctx, srcCam, srcV, GRID_V, 1.15, false);
  paintMarked(src.ctx, srcCam, srcH, GRID_H, 1.15, false);
  paintMarked(src.ctx, srcCam, srcCircle, CIRCLE_C, 1.7, false);
  paintMarked(src.ctx, srcCam, srcRay1, ANGLE_C, 1.8, false);
  paintMarked(src.ctx, srcCam, srcRay2, ANGLE_C, 1.8, false);
  drawArcAt(src.ctx, srcCam, angle, angle.a, angle.b, ANGLE_C, 1.8);
  drawAxes(src.ctx, srcCam, srcView, src.width, src.height);
  paintMarked(src.ctx, srcCam, srcV, GRID_V, 1.15, true);
  paintMarked(src.ctx, srcCam, srcH, GRID_H, 1.15, true);
  paintMarked(src.ctx, srcCam, srcCircle, CIRCLE_C, 1.7, true);
  paintMarked(src.ctx, srcCam, srcRay1, ANGLE_C, 1.8, true);
  paintMarked(src.ctx, srcCam, srcRay2, ANGLE_C, 1.8, true);
  drawFigureSource(src.ctx, srcCam);

  const dstV = imageRuns.filter((run) => run.kind === "v");
  const dstH = imageRuns.filter((run) => run.kind === "h");
  const dstCircle = circleRun.map((pts) => ({ key: "circle", pts }));
  const dstRay1 = ray1Run.map((pts) => ({ key: "ray1", pts }));
  const dstRay2 = ray2Run.map((pts) => ({ key: "ray2", pts }));
  paintMarked(dst.ctx, dstCam, dstV, GRID_V, 1.25, false);
  paintMarked(dst.ctx, dstCam, dstH, GRID_H, 1.25, false);
  paintMarked(dst.ctx, dstCam, dstCircle, CIRCLE_C, 1.9, false);
  paintMarked(dst.ctx, dstCam, dstRay1, ANGLE_C, 1.9, false);
  paintMarked(dst.ctx, dstCam, dstRay2, ANGLE_C, 1.9, false);

  const seen = imageAngle(fn);
  if (seen) drawArcAt(dst.ctx, dstCam, seen.w0, seen.t1, seen.t2, ANGLE_C, 1.9);
  drawAxes(dst.ctx, dstCam, dstView, dst.width, dst.height);
  paintMarked(dst.ctx, dstCam, dstV, GRID_V, 1.25, true);
  paintMarked(dst.ctx, dstCam, dstH, GRID_H, 1.25, true);
  paintMarked(dst.ctx, dstCam, dstCircle, CIRCLE_C, 1.9, true);
  paintMarked(dst.ctx, dstCam, dstRay1, ANGLE_C, 1.9, true);
  paintMarked(dst.ctx, dstCam, dstRay2, ANGLE_C, 1.9, true);
  drawFigureImage(dst.ctx, dstCam, figureImage);

  drawHandle(src.ctx, srcCam, circle, "#111111", hover === "center" || drag === "center" ? 7 : 5.5);
  drawHandle(src.ctx, srcCam, angle, ANGLE_C, hover === "vertex" || drag === "vertex" ? 7 : 5.5);
  drawStar(src.ctx, srcCam, probe, hover === "probe" || drag === "probe" ? 11 : 9);

  const centerImage = fn(circle);
  if (centerImage && Number.isFinite(centerImage.re) && Number.isFinite(centerImage.im)) {
    drawHandle(dst.ctx, dstCam, centerImage, "#111111", 5);
  }
  if (seen) drawHandle(dst.ctx, dstCam, seen.w0, ANGLE_C, 5.5);
  const image = fn(probe);
  if (image && Number.isFinite(image.re) && Number.isFinite(image.im)) {
    drawStar(dst.ctx, dstCam, image, 9);
  }

  const open = foldAngle(angle.a, angle.b);
  const imageOpen = seen ? `${(seen.open * 180 / Math.PI).toFixed(1)}°` : "无定义";
  readoutEl.textContent = [
    `z = ${formatComplex(probe)}    f(z) = ${formatComplex(image)}`,
    `圆心 ${formatComplex(circle)}    半径 ${Number(circle.r.toFixed(3))}`,
    `顶点 ${formatComplex(angle)}    张角 ${(open * 180 / Math.PI).toFixed(1)}°    像的张角 ${imageOpen}`
  ].join("\n");
}

function inFigure(re, im) {
  const x = re - figure.re;
  const y = im - figure.im;
  return FIGURE_PARTS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function finiteImage(z, fn) {
  try {
    const w = fn(z);
    if (!w || !Number.isFinite(w.re) || !Number.isFinite(w.im)) return null;
    if (Math.hypot(w.re, w.im) > 1e6) return null;
    return w;
  } catch {
    return null;
  }
}

function figureBoundary() {
  const pts = [];
  const n = FIGURE_OUTLINE.length;
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = FIGURE_OUTLINE[i];
    const [x1, y1] = FIGURE_OUTLINE[(i + 1) % n];
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.006));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      pts.push({
        re: figure.re + x0 + (x1 - x0) * t,
        im: figure.im + y0 + (y1 - y0) * t
      });
    }
  }
  pts.push(pts[0]);
  return pts;
}

function figureImageOf(fn) {
  const runs = [];
  let run = [];
  let broke = false;
  for (const point of figureBoundary()) {
    const w = finiteImage(point, fn);
    if (!w) {
      broke = true;
      if (run.length > 2) runs.push(run);
      run = [];
    } else {
      run.push(w);
    }
  }
  if (run.length > 2) runs.push(run);
  if (!broke && runs.length === 1) {
    return { kind: "boundary", runs, points: runs[0] };
  }
  const quads = figureMesh(fn);
  const points = runs.flat();
  for (const quad of quads) points.push(...quad);
  return { kind: "mesh", runs, quads, points };
}

function figureMesh(fn) {
  const step = 0.028;
  const width = 0.56;
  const height = 0.86;
  const nx = Math.ceil(width / step);
  const ny = Math.ceil(height / step);
  const grid = [];
  for (let j = 0; j <= ny; j += 1) {
    const row = [];
    const im = figure.im + Math.min(height, j * step);
    for (let i = 0; i <= nx; i += 1) {
      const re = figure.re + Math.min(width, i * step);
      row.push(finiteImage({ re, im }, fn));
    }
    grid.push(row);
  }
  const cells = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const re = figure.re + (i + 0.5) * step;
      const im = figure.im + (j + 0.5) * step;
      if (!inFigure(re, im)) continue;
      const corners = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
      if (corners.some((corner) => !corner)) continue;
      const span = Math.max(
        Math.hypot(corners[1].re - corners[0].re, corners[1].im - corners[0].im),
        Math.hypot(corners[2].re - corners[1].re, corners[2].im - corners[1].im),
        Math.hypot(corners[3].re - corners[2].re, corners[3].im - corners[2].im),
        Math.hypot(corners[0].re - corners[3].re, corners[0].im - corners[3].im)
      );
      cells.push({ corners, span });
    }
  }
  const spans = cells.map((cell) => cell.span).sort((a, b) => a - b);
  const typical = spans.length ? spans[Math.floor(spans.length * 0.6)] : 1;
  const limit = Math.max(typical * 8, 1e-4);
  return cells.filter((cell) => cell.span <= limit).map((cell) => cell.corners);
}

function traceWorld(ctx, cam, points, close) {
  ctx.beginPath();
  points.forEach((point, index) => {
    const [x, y] = cam.toScreen(point.re, point.im);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (close) ctx.closePath();
}

function drawFigureSource(ctx, cam) {
  ctx.save();
  ctx.fillStyle = FIGURE_INK;
  if (hover === "figure" || drag === "figure") {
    ctx.shadowColor = "rgba(28,36,51,0.35)";
    ctx.shadowBlur = 8;
  }
  traceWorld(ctx, cam, FIGURE_OUTLINE.map(([x, y]) => ({
    re: figure.re + x,
    im: figure.im + y
  })), true);
  ctx.fill();
  ctx.restore();
}

function drawFigureImage(ctx, cam, image) {
  ctx.save();
  ctx.fillStyle = FIGURE_INK;
  ctx.strokeStyle = FIGURE_INK;
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.5;
  if (image.kind === "boundary") {
    traceWorld(ctx, cam, image.runs[0], true);
    ctx.fill();
    ctx.stroke();
  } else {
    for (const corners of image.quads) {
      traceWorld(ctx, cam, corners, true);
      ctx.fill();
    }
  }
  ctx.restore();
}

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function screenDist(x, y, point) {
  const [sx, sy] = srcCamera.toScreen(point.re, point.im);
  return Math.hypot(x - sx, y - sy);
}

function distToRay(x, y, theta) {
  const [ox, oy] = srcCamera.toScreen(angle.re, angle.im);
  const dx = Math.cos(theta);
  const dy = -Math.sin(theta);
  const vx = x - ox;
  const vy = y - oy;
  const t = vx * dx + vy * dy;
  if (t < 16) return Infinity;
  const maxT = rayLength(angle, theta, srcDomain) * srcCamera.scale;
  const clamped = Math.min(t, maxT);
  if (clamped < 16) return Infinity;
  return Math.hypot(x - (ox + clamped * dx), y - (oy + clamped * dy));
}

function nearestGrid(x, y) {
  const domain = srcDomain;
  let best = null;
  const consider = (kind, value) => {
    const horizontal = kind === "h";
    const [ax, ay] = srcCamera.toScreen(horizontal ? domain.re0 : value, horizontal ? value : domain.im1);
    const [bx, by] = srcCamera.toScreen(horizontal ? domain.re1 : value, horizontal ? value : domain.im0);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) return;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.min(1, Math.max(0, t));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d <= 8 && (!best || d < best.d)) best = { id: gridKey(kind, value), d };
  };
  for (const value of values(domain.re0, domain.re1, domain.step)) consider("v", value);
  for (const value of values(domain.im0, domain.im1, domain.step)) consider("h", value);
  return best;
}

function hitTest(x, y) {
  if (!srcCamera || !srcDomain) return null;
  const dots = [
    ["probe", probe],
    ["center", circle],
    ["vertex", angle]
  ];
  let bestDot = null;
  for (const [id, point] of dots) {
    const d = screenDist(x, y, point);
    if (d <= 13 && (!bestDot || d < bestDot.d)) bestDot = { id, d };
  }
  if (bestDot) return bestDot.id;

  const world = srcCamera.toWorld(x, y);
  if (inFigure(world.re, world.im)) return "figure";

  let best = null;
  const edge = Math.abs(screenDist(x, y, circle) - circle.r * srcCamera.scale);
  if (edge <= 11) best = { id: "radius", d: edge };
  for (const [id, theta] of [["ray1", angle.a], ["ray2", angle.b]]) {
    const d = distToRay(x, y, theta);
    if (d <= 11 && (!best || d < best.d)) best = { id, d };
  }
  const grid = nearestGrid(x, y);
  if (grid && (!best || grid.d < best.d)) best = grid;
  return best ? best.id : null;
}

function cursorFor(id) {
  if (!id) return "crosshair";
  if (id.startsWith("v:") || id.startsWith("h:")) return "pointer";
  return "grab";
}

function clampPoint(point, domain, margin) {
  const mx = margin * (domain.re1 - domain.re0);
  const my = margin * (domain.im1 - domain.im0);
  return {
    re: Math.min(domain.re1 + mx, Math.max(domain.re0 - mx, point.re)),
    im: Math.min(domain.im1 + my, Math.max(domain.im0 - my, point.im))
  };
}

function applyDrag(event) {
  if (!srcCamera || !srcDomain || !drag) return;
  const { x, y } = canvasPoint(srcCanvas, event);
  const world = srcCamera.toWorld(x, y);
  if (drag === "probe") {
    const next = clampPoint(world, srcDomain, 0);
    probe = next;
  } else if (drag === "center") {
    const next = clampPoint(world, srcDomain, 0.25);
    circle = { ...circle, re: next.re, im: next.im };
  } else if (drag === "radius") {
    const dist = Math.hypot(world.re - circle.re, world.im - circle.im);
    const minR = 12 / srcCamera.scale;
    const maxR = 1.4 * Math.hypot(srcDomain.re1 - srcDomain.re0, srcDomain.im1 - srcDomain.im0);
    circle = { ...circle, r: Math.min(maxR, Math.max(minR, dist)) };
  } else if (drag === "vertex") {
    const next = clampPoint(world, srcDomain, 0.2);
    angle = { ...angle, re: next.re, im: next.im };
  } else if (drag === "figure" && figureGrab) {
    figure = clampPoint({
      re: world.re - figureGrab.re,
      im: world.im - figureGrab.im
    }, srcDomain, 0.15);
  } else if (drag === "ray1" || drag === "ray2") {
    const dx = world.re - angle.re;
    const dy = world.im - angle.im;
    if (Math.hypot(dx, dy) * srcCamera.scale < 12) return;
    const theta = Math.atan2(dy, dx);
    angle = { ...angle, [drag === "ray1" ? "a" : "b"]: theta };
  }
  draw();
}

function syncHover(event) {
  const { x, y } = canvasPoint(srcCanvas, event);
  const next = hitTest(x, y);
  if (next !== hover) {
    hover = next;
    srcCanvas.style.cursor = cursorFor(next);
    draw();
  }
}

srcCanvas.addEventListener("pointerdown", (event) => {
  const { x, y } = canvasPoint(srcCanvas, event);
  const hit = hitTest(x, y);
  if (hit === "figure") {
    const world = srcCamera.toWorld(x, y);
    figureGrab = { re: world.re - figure.re, im: world.im - figure.im };
  }
  const key = highlightKey(hit);
  if (hit && (hit.startsWith("v:") || hit.startsWith("h:"))) {
    selection = key;
    hover = hit;
    drag = null;
    srcCanvas.style.cursor = "pointer";
    draw();
    return;
  }
  if (!hit) {
    if (selection) {
      selection = null;
      draw();
    }
    return;
  }
  if (key) selection = key;
  drag = hit;
  hover = hit;
  try { srcCanvas.setPointerCapture(event.pointerId); } catch { /* 合成事件没有可捕获的指针 */ }
  srcCanvas.style.cursor = "grabbing";
  applyDrag(event);
});
srcCanvas.addEventListener("pointermove", (event) => {
  if (drag) applyDrag(event);
  else syncHover(event);
});
srcCanvas.addEventListener("pointerup", (event) => {
  drag = null;
  srcCanvas.style.cursor = "crosshair";
  syncHover(event);
});
srcCanvas.addEventListener("pointercancel", () => {
  drag = null;
  hover = null;
  srcCanvas.style.cursor = "crosshair";
  draw();
});

resetParamsBtn.addEventListener("click", () => resetParams());

for (const field of Object.values(domainFields)) {
  field.addEventListener("input", () => draw());
}
autoFitEl.addEventListener("change", () => draw());
window.addEventListener("resize", () => draw());
window.addEventListener("load", () => draw());

setupTemplates();
selectTemplate("square");
})();
