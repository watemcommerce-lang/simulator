import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  float,
  boolean,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// =============================================================================
// Tabela: questions
// Armazena as questões com suporte completo a LaTeX, parâmetros TRI (3PL),
// metadados ENEM e alternativas em formato JSON.
// =============================================================================

export const questions = mysqlTable(
  "questions",
  {
    // --- Identificação ---
    id: int("id").primaryKey().autoincrement(),

    // --- Metadados da fonte ---
    fonte: varchar("fonte", { length: 50 }).notNull().default("ENEM"),
    ano: int("ano"),

    // --- Classificação pedagógica ---
    conteudo_principal: varchar("conteudo_principal", { length: 100 }).notNull(),
    tags: json("tags").$type<string[]>().notNull().default([]),

    // --- Nível de dificuldade ---
    // Mapeado diretamente do JSON do professor
    nivel_dificuldade: mysqlEnum("nivel_dificuldade", [
      "Muito Baixa",
      "Baixa",
      "Média",
      "Alta",
      "Muito Alta",
    ])
      .notNull()
      .default("Média"),

    // --- Parâmetros TRI (Modelo Logístico 3PL) ---
    // a: discriminação  (tipicamente entre 0.5 e 2.5)
    // b: dificuldade    (escala logit, tipicamente entre -3 e +3)
    // c: acerto casual  (pseudo-chute, tipicamente entre 0.15 e 0.25)
    param_a: float("param_a").notNull().default(1.0),
    param_b: float("param_b").notNull().default(0.0),
    param_c: float("param_c").notNull().default(0.2),

    // --- Conteúdo da questão (suporta LaTeX com $...$ e $$...$$) ---
    enunciado: text("enunciado").notNull(),
    url_imagem: varchar("url_imagem", { length: 512 }),

    // --- Alternativas ---
    // Formato: { "A": "texto...", "B": "texto...", ... }
    // Os textos podem conter LaTeX inline ($...$)
    alternativas: json("alternativas")
      .$type<Record<string, string>>()
      .notNull(),

    // --- Gabarito ---
    gabarito: varchar("gabarito", { length: 1 }).notNull(),

    // --- Resolução comentada (suporta LaTeX) ---
    comentario_resolucao: text("comentario_resolucao"),

    // --- Controle ---
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Índices para filtros comuns no simulador e painel admin
    idxConteudo: index("idx_conteudo_principal").on(table.conteudo_principal),
    idxDificuldade: index("idx_nivel_dificuldade").on(table.nivel_dificuldade),
    idxFonteAno: index("idx_fonte_ano").on(table.fonte, table.ano),
    idxActive: index("idx_active").on(table.active),
  })
);

// =============================================================================
// Tabela: simulations
// Sessão de simulado de um aluno, com suporte às 3 etapas progressivas.
// =============================================================================

export const simulations = mysqlTable(
  "simulations",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: varchar("user_id", { length: 128 }).notNull(),
    stage: int("stage").notNull().default(1), // 1, 2 ou 3

    // Resultado
    score: float("score"), // Nota TRI (apenas Etapa 3) ou % acertos
    triTheta: float("tri_theta"), // Estimativa de habilidade θ (Etapa 3)
    correctCount: int("correct_count"),
    totalQuestions: int("total_questions"),
    totalTimeSeconds: int("total_time_seconds"),

    // Estado
    status: mysqlEnum("status", ["in_progress", "completed", "abandoned"])
      .notNull()
      .default("in_progress"),

    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    idxUser: index("idx_user_id").on(table.userId),
    idxUserStage: index("idx_user_stage").on(table.userId, table.stage),
    idxStatus: index("idx_status").on(table.status),
  })
);

// =============================================================================
// Tabela: simulation_answers
// Resposta do aluno a cada questão dentro de um simulado.
// =============================================================================

export const simulationAnswers = mysqlTable(
  "simulation_answers",
  {
    id: int("id").primaryKey().autoincrement(),
    simulationId: int("simulation_id")
      .notNull()
      .references(() => simulations.id, { onDelete: "cascade" }),
    questionId: int("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),

    selectedAnswer: varchar("selected_answer", { length: 1 }), // null = não respondida
    isCorrect: boolean("is_correct"),
    timeSpentSeconds: int("time_spent_seconds"),
    questionOrder: int("question_order").notNull(), // posição no simulado

    answeredAt: timestamp("answered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    idxSimulation: index("idx_simulation_id").on(table.simulationId),
    idxQuestion: index("idx_question_id").on(table.questionId),
  })
);

// =============================================================================
// Relações (Drizzle Relations API)
// =============================================================================

export const questionsRelations = relations(questions, ({ many }) => ({
  answers: many(simulationAnswers),
}));

export const simulationsRelations = relations(simulations, ({ many }) => ({
  answers: many(simulationAnswers),
}));

export const simulationAnswersRelations = relations(
  simulationAnswers,
  ({ one }) => ({
    simulation: one(simulations, {
      fields: [simulationAnswers.simulationId],
      references: [simulations.id],
    }),
    question: one(questions, {
      fields: [simulationAnswers.questionId],
      references: [questions.id],
    }),
  })
);

// =============================================================================
// Tipos inferidos (úteis no TypeScript do servidor)
// =============================================================================

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;
export type SimulationAnswer = typeof simulationAnswers.$inferSelect;
export type NewSimulationAnswer = typeof simulationAnswers.$inferInsert;
