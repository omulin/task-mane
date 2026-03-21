import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.users.createMany({
    data: [
      {
        name: "山田",
        email: "yamada@test.com",
        password: "1234",
        role: "USER",
      },
      {
        name: "佐藤",
        email: "sato@test.com",
        password: "1234",
        role: "STAFF",
      },
    ],
  });

  await prisma.tasks.createMany({
    data: [
      {
        title: "作業訓練",
        status: "DOING",
        assigneeId: 1,
        createdById: 2,
        week: 3,
      },
      {
        title: "清掃",
        status: "DONE",
        assigneeId: 1,
        createdById: 2,
        week: 3,
      },
      {
        title: "PC作業",
        status: "TODO",
        assigneeId: 1,
        createdById: 2,
        week: 3,
      },
    ],
  });
}

main();