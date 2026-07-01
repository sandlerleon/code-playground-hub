// 20-chapter curriculum per language. Titles are shared (universal CS path),
// starter snippets are language-specific.

export type Chapter = {
  id: string; // stable per language: `${slug}-01` etc.
  n: number;
  title: string;
  objective: string;
  starter: string;
};

const TITLES: { title: string; objective: string }[] = [
  { title: "Hello, World", objective: "Print output and run your first program." },
  { title: "Variables & Types", objective: "Declare variables, understand basic types." },
  { title: "Numbers & Math", objective: "Arithmetic, operators, and numeric precision." },
  { title: "Strings", objective: "Create, format, and manipulate strings." },
  { title: "Booleans & Logic", objective: "Boolean expressions and logical operators." },
  { title: "Conditionals", objective: "Use if/else to branch program flow." },
  { title: "Loops", objective: "Repeat work with for and while loops." },
  { title: "Arrays / Lists", objective: "Collect values in ordered collections." },
  { title: "Maps / Dictionaries", objective: "Store key-value pairs." },
  { title: "Functions", objective: "Define and call reusable functions." },
  { title: "Scope & Closures", objective: "Understand variable scope and closures." },
  { title: "Error Handling", objective: "Handle failures with try/catch." },
  { title: "Objects & Classes", objective: "Model data with objects or classes." },
  { title: "Inheritance & Interfaces", objective: "Share behavior between types." },
  { title: "Modules & Imports", objective: "Split code across files." },
  { title: "File I/O", objective: "Read and write files." },
  { title: "Async & Concurrency", objective: "Do multiple things at once." },
  { title: "Testing Basics", objective: "Write assertions and simple tests." },
  { title: "Data Structures", objective: "Stacks, queues, and hash maps." },
  { title: "Mini Project", objective: "Build a tiny end-to-end program." },
];

// Minimal starter per language per chapter — kept short on purpose.
// For chapters without a bespoke snippet we fall back to the language's hello.
const STARTERS: Record<string, string[]> = {
  javascript: [
    `console.log("Hello, cadet!");`,
    `let name = "Ada";\nlet age = 30;\nconsole.log(name, age);`,
    `console.log(2 ** 10);\nconsole.log(7 / 2, Math.floor(7 / 2));`,
    `const who = "world";\nconsole.log(\`Hello, \${who}!\`);`,
    `console.log(true && false);\nconsole.log(!true || (1 < 2));`,
    `const x = 7;\nif (x % 2 === 0) console.log("even"); else console.log("odd");`,
    `for (let i = 1; i <= 5; i++) console.log(i);`,
    `const xs = [1, 2, 3];\nxs.push(4);\nconsole.log(xs.map(n => n * n));`,
    `const m = { a: 1, b: 2 };\nfor (const [k, v] of Object.entries(m)) console.log(k, v);`,
    `function add(a, b) { return a + b; }\nconsole.log(add(2, 3));`,
    `function make() { let c = 0; return () => ++c; }\nconst tick = make();\nconsole.log(tick(), tick());`,
    `try { JSON.parse("nope"); } catch (e) { console.log("caught:", e.message); }`,
    `class Dog { constructor(n){ this.n = n; } bark(){ return this.n + " woofs"; } }\nconsole.log(new Dog("Rex").bark());`,
    `class Animal { speak(){ return "…"; } }\nclass Cat extends Animal { speak(){ return "meow"; } }\nconsole.log(new Cat().speak());`,
    `// Modules require a bundler. Practice by defining helpers locally:\nconst utils = { double: n => n * 2 };\nconsole.log(utils.double(21));`,
    `// Browser JS has no fs. Simulate:\nconst file = "line1\\nline2";\nconsole.log(file.split("\\n"));`,
    `async function main(){ const r = await Promise.resolve(42); console.log(r); }\nmain();`,
    `function assert(c, m){ if(!c) throw new Error(m); }\nassert(1 + 1 === 2, "math");\nconsole.log("ok");`,
    `const stack = [];\nstack.push(1); stack.push(2);\nconsole.log(stack.pop());`,
    `// Guess the number\nconst secret = 7;\nfor (const g of [3, 9, 7]) console.log(g === secret ? "win" : g < secret ? "up" : "down");`,
  ],
  python: [
    `print("Hello, cadet!")`,
    `name = "Ada"\nage = 30\nprint(name, age)`,
    `print(2 ** 10)\nprint(7 / 2, 7 // 2)`,
    `who = "world"\nprint(f"Hello, {who}!")`,
    `print(True and False)\nprint(not True or 1 < 2)`,
    `x = 7\nprint("even" if x % 2 == 0 else "odd")`,
    `for i in range(1, 6):\n    print(i)`,
    `xs = [1, 2, 3]\nxs.append(4)\nprint([n*n for n in xs])`,
    `m = {"a": 1, "b": 2}\nfor k, v in m.items():\n    print(k, v)`,
    `def add(a, b):\n    return a + b\nprint(add(2, 3))`,
    `def make():\n    c = 0\n    def tick():\n        nonlocal c\n        c += 1\n        return c\n    return tick\nt = make()\nprint(t(), t())`,
    `try:\n    int("nope")\nexcept ValueError as e:\n    print("caught:", e)`,
    `class Dog:\n    def __init__(self, n): self.n = n\n    def bark(self): return f"{self.n} woofs"\nprint(Dog("Rex").bark())`,
    `class Animal:\n    def speak(self): return "…"\nclass Cat(Animal):\n    def speak(self): return "meow"\nprint(Cat().speak())`,
    `import math\nprint(math.sqrt(16))`,
    `# Piston sandboxes FS; use in-memory instead\ndata = "line1\\nline2"\nprint(data.splitlines())`,
    `import asyncio\nasync def main():\n    print(await asyncio.sleep(0, result=42))\nasyncio.run(main())`,
    `def add(a, b): return a + b\nassert add(2, 3) == 5\nprint("ok")`,
    `stack = []\nstack.append(1); stack.append(2)\nprint(stack.pop())`,
    `secret = 7\nfor g in [3, 9, 7]:\n    print("win" if g == secret else "up" if g < secret else "down")`,
  ],
};

// Fallback: minimal per-language "hello" style so every language has 20 chapters.
function fallbackStarter(slug: string, i: number, hello: string): string {
  const label = TITLES[i].title;
  return `// Chapter ${i + 1}: ${label}\n// Ask Janeway to walk you through this topic in ${slug}.\n${hello}`;
}

export function buildCurriculum(slug: string, hello: string): Chapter[] {
  const list = STARTERS[slug];
  return TITLES.map((t, i) => ({
    id: `${slug}-${String(i + 1).padStart(2, "0")}`,
    n: i + 1,
    title: t.title,
    objective: t.objective,
    starter: list?.[i] ?? fallbackStarter(slug, i, hello),
  }));
}

export type ChapterStatus = "none" | "viewed" | "completed";
export type ProgressMap = Record<string, ChapterStatus>;

export function loadProgress(slug: string): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`course-progress:${slug}`);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? (p as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveProgress(slug: string, p: ProgressMap) {
  try {
    window.localStorage.setItem(`course-progress:${slug}`, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
