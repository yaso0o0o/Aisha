// Creates an admin, or sets a new password for an existing one.
// Usage: npm run admin:create -- owner@example.com
// The password is typed in the terminal (hidden), never passed on the command line.
import { createInterface } from "node:readline";
import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";

const MIN_LENGTH = 12;

// Typed characters are not echoed; only the questions are printed.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
// Lines are queued so none is lost if they arrive before the question is asked.
const lines = rl[Symbol.asyncIterator]();

async function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  const { value, done } = await lines.next();
  process.stdout.write("\n");
  return done ? "" : String(value);
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run admin:create -- owner@example.com");
    process.exit(1);
  }
  const password = await askHidden("Password: ");
  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if ((await askHidden("Repeat password: ")) !== password) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const existing = await prisma.admin.findUnique({ where: { email } });
  const saved = await prisma.admin.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  // A new password logs out every open session of this admin.
  if (existing) await prisma.session.deleteMany({ where: { adminId: saved.id } });
  console.log(existing ? `Password updated for ${email}.` : `Admin ${email} created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
    return prisma.$disconnect();
  });
