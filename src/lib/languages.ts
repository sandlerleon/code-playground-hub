export type Lang = {
  slug: string;
  name: string;
  monaco: string;
  piston: { language: string; version: string; filename: string };
  accent: string; // tailwind gradient classes
  icon: string; // unicode/emoji
  hello: string;
};

export const LANGUAGES: Lang[] = [
  {
    slug: "javascript",
    name: "JavaScript",
    monaco: "javascript",
    piston: { language: "javascript", version: "18.15.0", filename: "main.js" },
    accent: "from-yellow-400 to-amber-600",
    icon: "JS",
    hello: `// JavaScript\nconsole.log("Hello from JS");\n`,
  },
  {
    slug: "python",
    name: "Python",
    monaco: "python",
    piston: { language: "python", version: "3.10.0", filename: "main.py" },
    accent: "from-sky-400 to-blue-600",
    icon: "Py",
    hello: `# Python\nprint("Hello from Python")\n`,
  },
  {
    slug: "typescript",
    name: "TypeScript",
    monaco: "typescript",
    piston: { language: "typescript", version: "5.0.3", filename: "main.ts" },
    accent: "from-blue-400 to-indigo-600",
    icon: "TS",
    hello: `const greet = (name: string): string => \`Hello, \${name}\`;\nconsole.log(greet("TS"));\n`,
  },
  {
    slug: "java",
    name: "Java",
    monaco: "java",
    piston: { language: "java", version: "15.0.2", filename: "Main.java" },
    accent: "from-orange-400 to-red-600",
    icon: "Jv",
    hello: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}\n`,
  },
  {
    slug: "cpp",
    name: "C++",
    monaco: "cpp",
    piston: { language: "c++", version: "10.2.0", filename: "main.cpp" },
    accent: "from-blue-500 to-cyan-600",
    icon: "C++",
    hello: `#include <iostream>\nint main() {\n  std::cout << "Hello from C++" << std::endl;\n  return 0;\n}\n`,
  },
  {
    slug: "csharp",
    name: "C#",
    monaco: "csharp",
    piston: { language: "csharp", version: "6.12.0", filename: "main.cs" },
    accent: "from-violet-500 to-purple-700",
    icon: "C#",
    hello: `using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello from C#");\n  }\n}\n`,
  },
  {
    slug: "go",
    name: "Go",
    monaco: "go",
    piston: { language: "go", version: "1.16.2", filename: "main.go" },
    accent: "from-cyan-400 to-teal-600",
    icon: "Go",
    hello: `package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello from Go")\n}\n`,
  },
  {
    slug: "rust",
    name: "Rust",
    monaco: "rust",
    piston: { language: "rust", version: "1.68.2", filename: "main.rs" },
    accent: "from-orange-500 to-rose-700",
    icon: "Rs",
    hello: `fn main() {\n    println!("Hello from Rust");\n}\n`,
  },
  {
    slug: "php",
    name: "PHP",
    monaco: "php",
    piston: { language: "php", version: "8.2.3", filename: "main.php" },
    accent: "from-indigo-400 to-purple-600",
    icon: "PHP",
    hello: `<?php\necho "Hello from PHP\\n";\n`,
  },
  {
    slug: "ruby",
    name: "Ruby",
    monaco: "ruby",
    piston: { language: "ruby", version: "3.0.1", filename: "main.rb" },
    accent: "from-red-500 to-rose-700",
    icon: "Rb",
    hello: `puts "Hello from Ruby"\n`,
  },
];

export const getLang = (slug: string) => LANGUAGES.find((l) => l.slug === slug);
