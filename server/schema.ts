import {
  mysqlTable,
  int,
  varchar,
  boolean,
  timestamp,
  mysqlEnum,
  index,
  json,
  text,
  float,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// =============================================================================
// Tabela: users
// =============================================================================

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["student", "admin"]).notNull().default("student"),
  active: boolean("active").notNull().default(true),
  // Controlo de assinatura — null = sem expiração (admin/free)
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// Tabela: questions
// =============================================================================

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").primaryKey().autoincrement(),
    fonte: varchar("fonte", { length: 50 }).notNull().default("ENEM"),
    ano: int("ano"),
    conteudo_principal: varchar("conteudo_principal", { length: 100 }).notNull(),
    tags: json("tags").$type<string[]>().notNull().default([]),
    nivel_dificuldade: mysqlEnum("nivel_dificuldade", [
      "Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta",
    ]).notNull().default("Média"),
    param_a: float("param_a").notNull().default(1.0),
    param_b: float("param_b").notNull().default(0.0),
    param_c: float("param_c").notNull().default(0.2),
    enunciado: text("enunciado").notNull(),
    url_imagem: varchar("url_imagem", { length: 512 }),
    alternativas: json("alternativas").$type<Record<string, any>>().notNull(),
    gabarito: varchar("gabarito", { length: 1 }).notNull(),
    comentario_resolucao: text("comentario_resolucao"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxConteudo: index("idx_conteudo_principal").on(t.conteudo_principal),
    idxActive: index("idx_active").on(t.active),
  })
);

// =============================================================================
// Tabela: simulations
// =============================================================================

export const simulations = mysqlTable(
  "simulations",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id),
    stage: int("stage").notNull().default(1),
    score: float("score"),
    triTheta: float("tri_theta"),
    correctCount: int("correct_count"),
    totalQuestions: int("total_questions"),
    totalTimeSeconds: int("total_time_seconds"),
    status: mysqlEnum("status", ["in_progress", "completed", "abandoned"])
      .notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    idxUser: index("idx_user_id").on(t.userId),
    idxUserStage: index("idx_user_stage").on(t.userId, t.stage),
  })
);

// =============================================================================
// Tabela: simulation_answers
// =============================================================================

export const simulationAnswers = mysqlTable(
  "simulation_answers",
  {
    id: int("id").primaryKey().autoincrement(),
    simulationId: int("simulation_id").notNull().references(() => simulations.id, { onDelete: "cascade" }),
    questionId: int("question_id").notNull().references(() => questions.id, { onDelete: "restrict" }),
    selectedAnswer: varchar("selected_answer", { length: 1 }),
    isCorrect: boolean("is_correct"),
    timeSpentSeconds: int("time_spent_seconds"),
    questionOrder: int("question_order").notNull(),
    answeredAt: timestamp("answered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxSimulation: index("idx_simulation_id").on(t.simulationId),
  })
);

// =============================================================================
// Relações
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  simulations: many(simulations),
}));

export const simulationsRelations = relations(simulations, ({ one, many }) => ({
  user: one(users, { fields: [simulations.userId], references: [users.id] }),
  answers: many(simulationAnswers),
}));

export const simulationAnswersRelations = relations(simulationAnswers, ({ one }) => ({
  simulation: one(simulations, { fields: [simulationAnswers.simulationId], references: [simulations.id] }),
  question: one(questions, { fields: [simulationAnswers.questionId], references: [questions.id] }),
}));


// =============================================================================
// Tabela: daily_challenges — 3 questões diárias por aluno
// =============================================================================

export const dailyChallenges = mysqlTable(
  "daily_challenges",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id),
    challengeDate: varchar("challenge_date", { length: 10 }).notNull(), // YYYY-MM-DD
    questionIds: json("question_ids").$type<number[]>().notNull(),
    answers: json("answers").$type<Record<string, string>>().notNull().default({}),
    completed: boolean("completed").notNull().default(false),
    correctCount: int("correct_count"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxUserDate: index("idx_user_date").on(t.userId, t.challengeDate),
  })
);

export const dailyChallengesRelations = relations(dailyChallenges, ({ one }) => ({
  user: one(users, { fields: [dailyChallenges.userId], references: [users.id] }),
}));

export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type NewDailyChallenge = typeof dailyChallenges.$inferInsert;

// =============================================================================
// Tipos
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;
export type SimulationAnswer = typeof simulationAnswers.$inferSelect;
export type NewSimulationAnswer = typeof simulationAnswers.$inferInsert;
