(() => {
const FUNCS = new Set([
  "exp", "log", "ln", "sqrt", "sin", "cos", "tan",
  "sinh", "cosh", "tanh", "abs", "re", "im", "conj"
]);

const CONSTS = new Set(["z", "i", "e", "pi", "π"]);

function cnum(re, im = 0) {
  return { re, im };
}

function cadd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

function csub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cmul(a, b) {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cdiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d < 1e-18) return null;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d
  };
}

function cexp(a) {
  const er = Math.exp(Math.max(-40, Math.min(40, a.re)));
  return { re: er * Math.cos(a.im), im: er * Math.sin(a.im) };
}

function clog(a) {
  const r = Math.hypot(a.re, a.im);
  if (r < 1e-15) return null;
  return { re: Math.log(r), im: Math.atan2(a.im, a.re) };
}

function cpow(a, b) {
  if (Math.hypot(a.re, a.im) < 1e-15) {
    if (b.re > 1e-12 && Math.abs(b.im) < 1e-12) return { re: 0, im: 0 };
    return null;
  }
  return cexp(cmul(b, clog(a)));
}

function csin(a) {
  return {
    re: Math.sin(a.re) * Math.cosh(a.im),
    im: Math.cos(a.re) * Math.sinh(a.im)
  };
}

function ccos(a) {
  return {
    re: Math.cos(a.re) * Math.cosh(a.im),
    im: -Math.sin(a.re) * Math.sinh(a.im)
  };
}

function csinh(a) {
  const ep = cexp(a);
  const em = cexp({ re: -a.re, im: -a.im });
  return { re: (ep.re - em.re) / 2, im: (ep.im - em.im) / 2 };
}

function ccosh(a) {
  const ep = cexp(a);
  const em = cexp({ re: -a.re, im: -a.im });
  return { re: (ep.re + em.re) / 2, im: (ep.im + em.im) / 2 };
}

function tokenize(input) {
  const s = String(input);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "π") {
      tokens.push({ type: "id", value: "π" });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      if (s[j] === "e" || s[j] === "E") {
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k += 1;
        const start = k;
        while (k < s.length && /[0-9]/.test(s[k])) k += 1;
        if (k > start) j = k;
      }
      const text = s.slice(i, j);
      if (text === "." || Number.isNaN(Number(text))) {
        throw new Error(`无法识别的数字「${text}」`);
      }
      tokens.push({ type: "num", value: Number(text) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j += 1;
      tokens.push({ type: "id", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (s.startsWith("**", i)) {
      tokens.push({ type: "op", value: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      const value = ch === "×" ? "*" : ch === "÷" ? "/" : ch;
      tokens.push({ type: "op", value });
      i += 1;
      continue;
    }
    throw new Error(`无法识别的符号「${ch}」`);
  }
  return insertImplicitMultiply(tokens);
}

function insertImplicitMultiply(tokens) {
  const out = [];
  const endsValue = (t) =>
    t.type === "num" || t.type === "id" || (t.type === "op" && t.value === ")");
  const startsValue = (t) =>
    t.type === "num" || t.type === "id" || (t.type === "op" && t.value === "(");
  for (let i = 0; i < tokens.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = tokens[i];
    if (prev && endsValue(prev) && startsValue(cur)) {
      const call = prev.type === "id" && FUNCS.has(prev.value.toLowerCase()) && cur.value === "(";
      if (!call) out.push({ type: "op", value: "*" });
    }
    out.push(cur);
  }
  return out;
}

function parseExpression(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const eat = (value) => {
    const t = tokens[i];
    if (!t || t.value !== value) throw new Error("表达式不完整");
    i += 1;
    return t;
  };

  function parseAdd() {
    let node = parseMul();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = peek().value;
      i += 1;
      node = { type: "bin", op, left: node, right: parseMul() };
    }
    return node;
  }

  function parseMul() {
    let node = parseUnary();
    while (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
      const op = peek().value;
      i += 1;
      node = { type: "bin", op, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek() && peek().type === "op" && peek().value === "+") {
      i += 1;
      return parseUnary();
    }
    if (peek() && peek().type === "op" && peek().value === "-") {
      i += 1;
      return { type: "neg", arg: parseUnary() };
    }
    return parsePow();
  }

  function parsePow() {
    const base = parsePrimary();
    if (peek() && peek().type === "op" && peek().value === "^") {
      i += 1;
      return { type: "bin", op: "^", left: base, right: parseUnary() };
    }
    return base;
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error("表达式不完整");
    if (t.type === "num") {
      i += 1;
      return { type: "num", re: t.value, im: 0 };
    }
    if (t.type === "id") {
      i += 1;
      const name = t.value;
      if (peek() && peek().type === "op" && peek().value === "(" && FUNCS.has(name.toLowerCase())) {
        eat("(");
        const arg = parseAdd();
        eat(")");
        return { type: "call", name: name.toLowerCase(), arg };
      }
      return { type: "var", name };
    }
    if (t.type === "op" && t.value === "(") {
      eat("(");
      const node = parseAdd();
      eat(")");
      return node;
    }
    throw new Error("表达式不完整");
  }

  const ast = parseAdd();
  if (i !== tokens.length) throw new Error("表达式末尾有多余的符号");
  return ast;
}

function collectSymbols(node, into) {
  if (!node) return;
  if (node.type === "var") {
    if (!CONSTS.has(node.name) && !FUNCS.has(node.name.toLowerCase())) into.add(node.name);
    return;
  }
  if (node.type === "neg" || node.type === "call") collectSymbols(node.arg, into);
  if (node.type === "bin") {
    collectSymbols(node.left, into);
    collectSymbols(node.right, into);
  }
}

function compile(input) {
  const ast = parseExpression(tokenize(input));
  const symbols = new Set();
  collectSymbols(ast, symbols);
  return { ast, symbols: [...symbols] };
}

function applyCall(name, arg) {
  if (!arg) return null;
  if (name === "exp") return cexp(arg);
  if (name === "log" || name === "ln") return clog(arg);
  if (name === "sqrt") return cpow(arg, { re: 0.5, im: 0 });
  if (name === "sin") return csin(arg);
  if (name === "cos") return ccos(arg);
  if (name === "tan") return cdiv(csin(arg), ccos(arg));
  if (name === "sinh") return csinh(arg);
  if (name === "cosh") return ccosh(arg);
  if (name === "tanh") return cdiv(csinh(arg), ccosh(arg));
  if (name === "abs") return { re: Math.hypot(arg.re, arg.im), im: 0 };
  if (name === "re") return { re: arg.re, im: 0 };
  if (name === "im") return { re: arg.im, im: 0 };
  if (name === "conj") return { re: arg.re, im: -arg.im };
  return null;
}

function evaluate(ast, z, env) {
  if (ast.type === "num") return { re: ast.re, im: ast.im };
  if (ast.type === "var") {
    if (ast.name === "z") return z;
    if (ast.name === "i") return { re: 0, im: 1 };
    if (ast.name === "e") return { re: Math.E, im: 0 };
    if (ast.name === "pi" || ast.name === "π") return { re: Math.PI, im: 0 };
    const value = env[ast.name];
    if (!value) throw new Error(`还没有给系数 ${ast.name} 赋值`);
    return value;
  }
  if (ast.type === "neg") {
    const v = evaluate(ast.arg, z, env);
    return v ? { re: -v.re, im: -v.im } : null;
  }
  if (ast.type === "call") return applyCall(ast.name, evaluate(ast.arg, z, env));
  const left = evaluate(ast.left, z, env);
  const right = evaluate(ast.right, z, env);
  if (!left || !right) return null;
  if (ast.op === "+") return cadd(left, right);
  if (ast.op === "-") return csub(left, right);
  if (ast.op === "*") return cmul(left, right);
  if (ast.op === "/") return cdiv(left, right);
  if (ast.op === "^") return cpow(left, right);
  return null;
}

function formatComplex(z, digits = 3) {
  if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return "无定义";
  const r = Number(z.re.toFixed(digits));
  const m = Number(z.im.toFixed(digits));
  if (m === 0) return String(r);
  if (r === 0) return m === 1 ? "i" : m === -1 ? "−i" : `${m}i`;
  const imag = m === 1 ? "i" : m === -1 ? "i" : `${Math.abs(m)}i`;
  return `${r} ${m < 0 ? "−" : "+"} ${imag}`;
}

window.ComplexMap = { compile, evaluate, formatComplex };
})();
