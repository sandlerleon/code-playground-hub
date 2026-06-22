export type Lesson = { title: string; prompt: string };
export type Module = { title: string; lessons: Lesson[] };

const COMMON: Module[] = [
  {
    title: "1 · Starfleet Basics",
    lessons: [
      { title: "Hello, Cadet — your first program", prompt: "Walk me through the Hello World program for {lang} step by step." },
      { title: "Variables & data types", prompt: "Teach me about variables and the basic data types in {lang}, with tiny examples." },
      { title: "Operators & expressions", prompt: "Explain arithmetic, comparison, and logical operators in {lang}." },
      { title: "Input & output", prompt: "Show me how to read input and print output in {lang}." },
    ],
  },
  {
    title: "2 · Control Flow",
    lessons: [
      { title: "If / else decisions", prompt: "Teach me conditionals (if/else) in {lang} with a small example I can run." },
      { title: "Loops (for / while)", prompt: "Walk me through for and while loops in {lang}, step by step." },
      { title: "Break, continue, early return", prompt: "Explain break, continue, and early returns in {lang} with examples." },
    ],
  },
  {
    title: "3 · Building Blocks",
    lessons: [
      { title: "Functions & parameters", prompt: "Teach me how to define and call functions in {lang}, including parameters and return values." },
      { title: "Scope & lifetime", prompt: "Explain variable scope and lifetime in {lang}." },
      { title: "Error handling", prompt: "Show me how error handling works in {lang} with a runnable example." },
    ],
  },
  {
    title: "4 · Data Structures",
    lessons: [
      { title: "Lists / arrays", prompt: "Teach me arrays/lists in {lang}: create, read, update, iterate." },
      { title: "Maps / dictionaries", prompt: "Teach me dictionaries/maps in {lang} with a worked example." },
      { title: "Strings in depth", prompt: "Walk me through string manipulation in {lang}." },
    ],
  },
  {
    title: "5 · Away Missions (Practice)",
    lessons: [
      { title: "FizzBuzz", prompt: "Coach me through writing FizzBuzz in {lang}. Don't give me the full code at once — guide me." },
      { title: "Reverse a string", prompt: "Coach me through reversing a string in {lang}, step by step." },
      { title: "Count word frequencies", prompt: "Help me build a program in {lang} that counts word frequencies in a piece of text." },
      { title: "Debug my current code", prompt: "Look at the code I have in the editor and help me improve or debug it." },
    ],
  },
];

export function getCurriculum(lang: string): Module[] {
  return COMMON.map((m) => ({
    title: m.title,
    lessons: m.lessons.map((l) => ({ title: l.title, prompt: l.prompt.replace(/\{lang\}/g, lang) })),
  }));
}
