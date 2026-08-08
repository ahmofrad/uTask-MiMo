import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LOCAL_SEED_EMAIL, LOCAL_SEED_PASSWORD } from "../src/lib/auth/seed-defaults";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to run the seed in production without ALLOW_PRODUCTION_SEED=true");
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? (isProduction ? "" : LOCAL_SEED_EMAIL);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProduction ? "" : LOCAL_SEED_PASSWORD);
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for a production seed");
  }
  if (isProduction && adminPassword.length < 16) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 16 characters in production");
  }

  console.log("🌱 Provisioning the initial owner account...");

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashPassword(adminPassword),
      status: "active",
    },
    create: {
      email: adminEmail,
      displayName: "Admin",
      passwordHash: hashPassword(adminPassword),
      locale: "fa_IR",
      status: "active",
    },
  });

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

  if (!isProduction) {
    const testUsers = [
      { email: "member@utask.local", displayName: "Member", type: "member" as const },
      { email: "guest@utask.local", displayName: "Guest", type: "guest" as const },
    ];
    for (const testUser of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: testUser.email },
        update: { passwordHash: hashPassword(LOCAL_SEED_PASSWORD), status: "active" },
        create: {
          email: testUser.email,
          displayName: testUser.displayName,
          passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
          locale: "en_US",
          status: "active",
        },
      });
      const role = await prisma.role.findFirst({
        where: { userId: user.id, type: testUser.type, scopeType: "global" },
      });
      if (!role) {
        await prisma.role.create({
          data: {
            userId: user.id,
            type: testUser.type,
            scopeType: "global",
            scopeId: null,
            grantedBy: admin.id,
          },
        });
      }
    }
  }

  console.log("✅ Initial owner account provisioned");
  if (!isProduction) {
    console.log("   Local E2E users: member@utask.local and guest@utask.local");
    console.log(`   Local development password: ${LOCAL_SEED_PASSWORD}`);
    console.log("");
    console.log("   Run 'pnpm db:sample' to add sample data (users, projects, tasks).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
