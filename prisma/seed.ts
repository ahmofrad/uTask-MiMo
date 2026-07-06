import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  console.log("🌱 Creating default admin user...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@taskapp.dev" },
    update: {},
    create: {
      email: "admin@taskapp.dev",
      displayName: "Admin",
      passwordHash: hashPassword("password"),
      locale: "fa_IR",
      status: "active",
    },
  });

  // Ensure admin has owner role for full permissions
  await prisma.role.upsert({
    where: {
      userId_type_scopeType_scopeId: {
        userId: admin.id,
        type: "owner",
        scopeType: "global",
        scopeId: null,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      type: "owner",
      scopeType: "global",
      scopeId: null,
    },
  });

  console.log("✅ Admin user created");
  console.log("   Email:    admin@taskapp.dev");
  console.log("   Password: password");
  console.log("");
  console.log("   Run 'pnpm db:sample' to add sample data (users, projects, tasks).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
