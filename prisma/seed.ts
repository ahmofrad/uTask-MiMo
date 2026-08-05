import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  console.log("🌱 Creating default admin user...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@utask.local" },
    update: {},
    create: {
      email: "admin@utask.local",
      displayName: "Admin",
      passwordHash: hashPassword("password123"),
      locale: "fa_IR",
      status: "active",
    },
  });

  // Ensure admin has owner role for full permissions
  const existingRole = await prisma.role.findFirst({
    where: { userId: admin.id, type: "owner", scopeType: "global" },
  });
  if (!existingRole) {
    await prisma.role.create({
      data: {
        userId: admin.id,
        type: "owner",
        scopeType: "global",
        scopeId: null,
      },
    });
  }

  console.log("✅ Admin user created");
  console.log("   Email:    admin@utask.local");
  console.log("   Password: password123");
  console.log("");
  console.log("   Run 'pnpm db:sample' to add sample data (users, projects, tasks).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
