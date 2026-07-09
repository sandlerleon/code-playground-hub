export type LetterGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F" | "—";

export function toLetterGrade(percent: number | null | undefined): LetterGrade {
  if (percent == null || Number.isNaN(percent)) return "—";
  const p = Math.round(percent);
  if (p >= 97) return "A+";
  if (p >= 93) return "A";
  if (p >= 90) return "A-";
  if (p >= 87) return "B+";
  if (p >= 83) return "B";
  if (p >= 80) return "B-";
  if (p >= 77) return "C+";
  if (p >= 73) return "C";
  if (p >= 70) return "C-";
  if (p >= 60) return "D";
  return "F";
}

export function gradeColor(g: LetterGrade): string {
  if (g === "—") return "text-muted-foreground";
  if (g.startsWith("A")) return "text-emerald-400";
  if (g.startsWith("B")) return "text-sky-400";
  if (g.startsWith("C")) return "text-amber-400";
  if (g === "D") return "text-orange-400";
  return "text-destructive";
}
