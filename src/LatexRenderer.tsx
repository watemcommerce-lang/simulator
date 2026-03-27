import React, { useMemo } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

interface LatexRendererProps {
  children: string;
  className?: string;
  fontSize?: "sm" | "base" | "lg" | "xl";
  inline?: boolean;
}

type Segment =
  | { type: "text"; content: string }
  | { type: "latex-display"; content: string }
  | { type: "latex-inline"; content: string }
  | { type: "image"; url: string };

function normalizeImageFormats(text: string): string {
  // Converte formato Markdown ![alt](url) para [Imagem: url]
  // Cobre questões já no banco importadas antes da correção do importador
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "[Imagem: $2]");
}

function parseSegments(rawText: string): Segment[] {
  const text = normalizeImageFormats(rawText);
  const segments: Segment[] = [];

  // Une todos os padrões: [Imagem: url], LaTeX display, LaTeX inline
  const combined = /\[Imagem(?::\s*(https?:\/\/[^\]]+))?\]|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\$([^\s$][^$]*?[^\s$]|\S)\$/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    const full = match[0];
    // É imagem?
    if (full.toLowerCase().startsWith("[imagem")) {
      const url = match[1];
      if (url) {
        segments.push({ type: "image", url });
      } else {
        // Placeholder — imagem sem URL
        segments.push({ type: "text", content: "[imagem não disponível]" });
      }
    } else if (match[2] !== undefined || match[3] !== undefined) {
      // Display: \[...\] ou $$...$$
      segments.push({ type: "latex-display", content: (match[2] ?? match[3]).trim() });
    } else {
      // Inline: \(...\) ou $...$
      segments.push({ type: "latex-inline", content: (match[4] ?? match[5] ?? "").trim() });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

function renderTextSegment(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    parts.forEach((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        nodes.push(<strong key={`b-${lineIdx}-${partIdx}`} className="font-semibold">{part.slice(2, -2)}</strong>);
      } else if (part.startsWith("*") && part.endsWith("*")) {
        nodes.push(<em key={`i-${lineIdx}-${partIdx}`}>{part.slice(1, -1)}</em>);
      } else if (part) {
        nodes.push(<React.Fragment key={`t-${lineIdx}-${partIdx}`}>{part}</React.Fragment>);
      }
    });
  });
  return nodes;
}

function renderKatex(latex: string, displayMode: boolean, key: string): React.ReactNode {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      macros: {
        "\\sen": "\\sin",
        "\\tg": "\\tan",
        "\\cotg": "\\cot",
        "\\cossec": "\\csc",
        "\\arc": "\\text{arc}",
        "\\mod": "\\text{mod}\\,",
        "\\log": "\\log",
      },
    });
    if (displayMode) {
      return <span key={key} className="block my-3 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <span key={key} className="inline-block align-middle" dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <code key={key} className="text-rose-600 bg-rose-50 px-1 rounded text-sm font-mono">{displayMode ? `$$${latex}$$` : `$${latex}$`}</code>;
  }
}

const fontSizeMap = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl" };

export function LatexRenderer({ children, className, fontSize = "base", inline = false }: LatexRendererProps) {
  const rendered = useMemo(() => {
    if (!children) return null;
    return parseSegments(children).map((seg, idx) => {
      const key = `seg-${idx}`;
      switch (seg.type) {
        case "latex-display": return renderKatex(seg.content, true, key);
        case "latex-inline": return renderKatex(seg.content, false, key);
        case "image": return (
          <img key={key} src={seg.url} alt="Imagem da questão"
            className="max-w-full rounded-lg my-2 mx-auto block"
            style={{ border: "1px solid #E2D9EE" }} />
        );
        case "text": return <React.Fragment key={key}>{renderTextSegment(seg.content)}</React.Fragment>;
      }
    });
  }, [children]);

  if (inline) return <span className={cn(fontSizeMap[fontSize], "leading-relaxed", className)} style={{ color: "var(--text-question)" }}>{rendered}</span>;
  return <div className={cn("leading-relaxed space-y-1", fontSizeMap[fontSize], className)} style={{ color: "var(--text-question)" }}>{rendered}</div>;
}

// =============================================================================
// Alternativa — suporte a LaTeX, imagem e texto
// =============================================================================

interface AlternativeProps {
  id: string;
  text: string;
  imageUrl?: string | null; // URL directa da imagem da alternativa
  selected: boolean;
  correct?: boolean | null;
  onClick: () => void;
  disabled?: boolean;
}

export function Alternative({ id, text, imageUrl, selected, correct, onClick, disabled = false }: AlternativeProps) {
  const isRevealed = correct !== null && correct !== undefined;
  const isCorrectAnswer = isRevealed && correct === true;
  const isWrongSelected = isRevealed && selected && correct === false;

  const borderColor = isCorrectAnswer ? "#00897B"
    : isWrongSelected ? "#E53935"
    : selected ? "#01738d"
    : "#E2D9EE";

  const bgColor = isCorrectAnswer ? "#E0F7F4"
    : isWrongSelected ? "#FFEBEE"
    : selected ? "#E0F7F4"
    : "#fff";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-3 text-left transition-all"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        border: `2px solid ${borderColor}`,
        background: bgColor,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !selected && !isCorrectAnswer ? 0.6 : 1,
      }}
    >
      <span
        className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{
          border: `2px solid ${borderColor}`,
          background: (selected && !isRevealed) || isCorrectAnswer ? borderColor : "transparent",
          color: (selected && !isRevealed) || isCorrectAnswer ? "#fff" : borderColor,
        }}
      >
        {id}
      </span>

      <div className="flex-1">
        {/* Imagem directa da alternativa (da API) */}
        {imageUrl && (
          <img src={imageUrl} alt={`Alternativa ${id}`}
            className="max-w-full rounded mb-1"
            style={{ maxHeight: 200, objectFit: "contain" }} />
        )}
        {/* Texto com suporte LaTeX */}
        {text && text !== "[Imagem]" && (
          <LatexRenderer inline fontSize="sm">{text}</LatexRenderer>
        )}
        {/* Se texto é só "[Imagem]" e não há imageUrl, avisa */}
        {text === "[Imagem]" && !imageUrl && (
          <span className="text-xs italic" style={{ color: "#94A3B8" }}>Imagem não disponível</span>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// QuestionCard
// =============================================================================

interface QuestionCardProps {
  order: number;
  total: number;
  enunciado: string;
  url_imagem?: string | null;
  alternativas: Record<string, string | { text?: string; file?: string }>;
  selectedAnswer: string | null;
  correctAnswer?: string | null;
  onAnswer: (id: string) => void;
  disabled?: boolean;
}

export function QuestionCard({
  order, total, enunciado, url_imagem, alternativas,
  selectedAnswer, correctAnswer, onAnswer, disabled = false,
}: QuestionCardProps) {
  const altEntries = Object.entries(alternativas).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
        Questão {order} de {total}
      </p>

      <LatexRenderer fontSize="base">{enunciado}</LatexRenderer>

      {url_imagem && !enunciado.includes(url_imagem) && (
        <figure className="my-3">
          <img src={url_imagem} alt={`Imagem da questão ${order}`}
            className="max-w-full rounded-xl mx-auto"
            style={{ border: "1px solid #E2D9EE" }} loading="lazy" />
        </figure>
      )}

      <div className="space-y-2.5">
        {altEntries.map(([id, value]) => {
          // Suporta tanto string simples quanto objeto {text, file}
          const text = typeof value === "string" ? value : (value.text ?? "");
          const imageUrl = typeof value === "object" ? value.file ?? null : null;

          const isSelected = selectedAnswer === id;
          const isCorrect = correctAnswer != null
            ? id === correctAnswer ? true : isSelected ? false : null
            : null;

          return (
            <Alternative key={id} id={id} text={text} imageUrl={imageUrl}
              selected={isSelected} correct={isCorrect}
              onClick={() => onAnswer(id)} disabled={disabled} />
          );
        })}
      </div>
    </div>
  );
}
