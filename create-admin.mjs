/**
 * create-admin.mjs
 * ----------------
 * Cria ou promove um utilizador para admin.
 *
 * Uso:
 *   node create-admin.mjs --email=teu@email.com --name="Nome" --password=senha123
 *   node create-admin.mjs --promote=teu@email.com   (promove conta existente)
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

dotenv.config();
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${salt}:${buf.toString("hex")}`;
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => { const [k, v] = a.slice(2).split("="); return [k, v]; })
  );

  // Modo: promover conta existente para admin
  if (args.promote) {
    const [rows] = await db.execute("SELECT id, email FROM users WHERE email = ? LIMIT 1", [args.promote]);
    if (!rows.length) { console.error(`❌ Utilizador não encontrado: ${args.promote}`); process.exit(1); }
    await db.execute("UPDATE users SET role = 'admin' WHERE email = ?", [args.promote]);
    console.log(`✅ ${args.promote} é agora admin.`);
    await db.end();
    return;
  }

  // Modo: criar novo admin
  const { email, name, password } = args;
  if (!email || !name || !password) {
    console.error("Uso: node create-admin.mjs --email=x --name=x --password=x");
    console.error("  ou: node create-admin.mjs --promote=email@existente.com");
    process.exit(1);
  }

  const [existing] = await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length) {
    await db.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
    console.log(`✅ Conta existente promovida a admin: ${email}`);
  } else {
    const hash = await hashPassword(password);
    await db.execute(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)",
      [name, email, hash]
    );
    console.log(`✅ Admin criado: ${email}`);
  }

  await db.end();
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
