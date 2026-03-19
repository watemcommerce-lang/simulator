/**
 * =============================================================================
 * LatexRenderer — renderização de LaTeX com KaTeX
 * =============================================================================
 * Ficheiro: client/src/components/LatexRenderer.tsx
 *
 * Suporta:
 *   - Blocos display:  $$...$$ e \[...\]
 *   - Inline:          $...$ e \(...\)
 *   - Markdown leve:   **negrito**, *itálico*, listas com bullet (*)
 *   - Quebras de linha preservadas
 *
 * Dependência: katex (já incluído via CDN ou instalar com pnpm add katex)
 *
 * Instalação:
 *   pnpm add katex
 *   pnpm add -D @types/katex
 *
 * E no index.css (ou index.html), importar o CSS do KaTeX:
 *   @import "katex/dist/katex.min.css";
 * =============================================================================
 */

import React, { useMemo } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

// =============================================================================
// Tipos
// =============================================================================

interface LatexRendererProps {
  /** Texto com LaTeX inline ($...$), display ($$...$$) e/ou markdown leve */
  children: string;
  /** Classes CSS adicionais no container */
  className?: string;
  /** Tamanho base do texto (herdado por padrão) */
  fontSize?: "sm" | "base" | "lg" | "xl";
  /** Se true, não aplica estilos de parágrafo (útil para alternativas) */
  inline?: boolean;
}

// =============================================================================
// Segmentos de parsing
// =============================================================================

type Segment =
  | { type: "text"; content: string }
  | { type: "latex-display"; content: string }
  | { type: "latex-inline"; content: string };

// =============================================================================
// Parser: divide o texto em segmentos de texto puro e LaTeX
// =============================================================================

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];

  // Regex que captura, em ordem de precedência:
  //   1. \[...\]  — display LaTeX (ambiente)
  //   2. $$...$$  — display LaTeX (dólar duplo)
  //   3. \(...\)  — inline LaTeX (ambiente)
  //   4. $...$    — inline LaTeX (dólar simples)
  //      (exige que o $ não seja precedido/seguido por espaço para evitar
  //       falsos positivos com valores monetários)
  const regex =
    /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\$([^\s$][^$]*?[^\s$]|\S)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Texto entre o último match e este
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const [full, envDisplay, dollarDisplay, envInline, dollarInline] = match;

    if (envDisplay !== undefined || dollarDisplay !== undefined) {
      segments.push({
        type: "latex-display",
        content: (envDisplay ?? dollarDisplay).trim(),
      });
    } else {
      segments.push({
        type: "latex-inline",
        content: (envInline ?? dollarInline ?? "").trim(),
      });
    }

    lastIndex = match.index + full.length;
  }

  // Texto restante
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

// =============================================================================
// Renderizador de texto puro com markdown leve
// =============================================================================

function renderTextSegment(text: string): React.ReactNode[] {
  // Quebra em linhas primeiro
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);

    // Processa negrito e itálico inline na linha
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    parts.forEach((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        nodes.push(
          <strong key={`b-${lineIdx}-${partIdx}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part.startsWith("*") && part.endsWith("*")) {
        nodes.push(
          <em key={`i-${lineIdx}-${partIdx}`}>{part.slice(1, -1)}</em>
        );
      } else if (part) {
        nodes.push(<React.Fragment key={`t-${lineIdx}-${partIdx}`}>{part}</React.Fragment>);
      }
    });
  });

  return nodes;
}

// =============================================================================
// Renderizador de LaTeX com KaTeX (com fallback em caso de erro)
// =============================================================================

function renderKatex(
  latex: string,
  displayMode: boolean,
  key: string
): React.ReactNode {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      // Macros comuns no ENEM
      macros: {
        "\\sen": "\\sin",
        "\\tg": "\\tan",
        "\\cotg": "\\cot",
        "\\arc": "\\text{arc}",
        "\\mod": "\\text{mod}\\,",
      },
    });

    if (displayMode) {
      return (
        <span
          key={key}
          className="block my-3 overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <span
        key={key}
        className="inline-block align-middle"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    // Fallback: mostra o LaTeX bruto com destaque
    return (
      <code
        key={key}
        className="text-rose-600 bg-rose-50 px-1 rounded text-sm font-mono"
        title="Erro de renderização LaTeX"
      >
        {displayMode ? `$$${latex}$$` : `$${latex}$`}
      </code>
    );
  }
}

// =============================================================================
// Componente principal
// =============================================================================

const fontSizeMap = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function LatexRenderer({
  children,
  className,
  fontSize = "base",
  inline = false,
}: LatexRendererProps) {
  const rendered = useMemo(() => {
    if (!children) return null;

    const segments = parseSegments(children);

    return segments.map((seg, idx) => {
      const key = `seg-${idx}`;
      switch (seg.type) {
        case "latex-display":
          return renderKatex(seg.content, true, key);
        case "latex-inline":
          return renderKatex(seg.content, false, key);
        case "text":
          return (
            <React.Fragment key={key}>
              {renderTextSegment(seg.content)}
            </React.Fragment>
          );
      }
    });
  }, [children]);

  if (inline) {
    return (
      <span className={cn(fontSizeMap[fontSize], "leading-relaxed", className)}>
        {rendered}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "leading-relaxed space-y-1",
        fontSizeMap[fontSize],
        className
      )}
    >
      {rendered}
    </div>
  );
}

// =============================================================================
// Componente de alternativa — linha única com LaTeX inline
// =============================================================================

interface AlternativeProps {
  /** "A", "B", "C", "D" ou "E" */
  id: string;
  text: string;
  selected: boolean;
  correct?: boolean | null; // null = ainda não revelado
  onClick: () => void;
  disabled?: boolean;
}

export function Alternative({
  id,
  text,
  selected,
  correct,
  onClick,
  disabled = false,
}: AlternativeProps) {
  // Estados visuais pós-correção
  const isRevealed = correct !== null && correct !== undefined;
  const isCorrectAnswer = isRevealed && correct === true;
  const isWrongSelected = isRevealed && selected && correct === false;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Base
        "w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left",
        "transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        // Estado neutro
        !selected && !isRevealed && "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
        // Selecionado (antes da correção)
        selected && !isRevealed && "border-primary bg-primary/10 text-primary font-medium",
        // Correcto revelado
        isCorrectAnswer && "border-emerald-500 bg-emerald-50 text-emerald-800",
        // Errado e selecionado
        isWrongSelected && "border-rose-500 bg-rose-50 text-rose-800",
        // Não selecionado após revelação
        isRevealed && !selected && !isCorrectAnswer && "border-border/50 bg-muted/30 opacity-60",
        // Desabilitado
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {/* Badge da letra */}
      <span
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center",
          "text-xs font-bold mt-0.5",
          !selected && !isRevealed && "border-muted-foreground/40 text-muted-foreground",
          selected && !isRevealed && "border-primary bg-primary text-primary-foreground",
          isCorrectAnswer && "border-emerald-600 bg-emerald-500 text-white",
          isWrongSelected && "border-rose-600 bg-rose-500 text-white",
        )}
      >
        {id}
      </span>

      {/* Texto com LaTeX */}
      <LatexRenderer inline className="flex-1 pt-0.5">
        {text}
      </LatexRenderer>
    </button>
  );
}

// =============================================================================
// Componente completo de questão — enunciado + alternativas
// =============================================================================

interface QuestionCardProps {
  order: number;
  total: number;
  enunciado: string;
  url_imagem?: string | null;
  alternativas: Record<string, string>;
  selectedAnswer: string | null;
  correctAnswer?: string | null; // revelado após finalizar
  onAnswer: (id: string) => void;
  disabled?: boolean;
}

export function QuestionCard({
  order,
  total,
  enunciado,
  url_imagem,
  alternativas,
  selectedAnswer,
  correctAnswer,
  onAnswer,
  disabled = false,
}: QuestionCardProps) {
  const altEntries = Object.entries(alternativas).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Questão {order} de {total}
      </p>

      {/* Enunciado */}
      <LatexRenderer fontSize="base" className="text-foreground">
        {enunciado}
      </LatexRenderer>

      {/* Imagem opcional */}
      {url_imagem && (
        <figure className="my-4">
          <img
            src={url_imagem}
            alt={`Imagem da questão ${order}`}
            className="max-w-full rounded-lg border border-border mx-auto"
            loading="lazy"
          />
        </figure>
      )}

      {/* Alternativas */}
      <div className="space-y-2.5">
        {altEntries.map(([id, texto]) => {
          const isSelected = selectedAnswer === id;
          const isCorrect =
            correctAnswer != null
              ? id === correctAnswer
                ? true
                : isSelected
                ? false
                : null
              : null;

          return (
            <Alternative
              key={id}
              id={id}
              text={texto}
              selected={isSelected}
              correct={isCorrect}
              onClick={() => onAnswer(id)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
}
