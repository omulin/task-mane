import { prisma } from "@/lib/prisma";

// 一覧取得
export async function GET() {
  const tasks = await prisma.tasks.findMany({
    orderBy: { id: "desc" },
  });

  return Response.json(tasks);
}

// 作成
export async function POST(req: Request) {
  const body = await req.json();

  const task = await prisma.tasks.create({
    data: {
      title: body.title,
      status: "TODO",
      approval: "PENDING",

      assigneeId: 1,
      createdById: 1,

      // 🔥 ここ重要（上書きしない）
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,

      week: 3,
    },
  });

  return Response.json(task);
}

// 削除
export async function DELETE(req: Request) {
  const body = await req.json();

  await prisma.tasks.delete({
    where: { id: body.id },
  });

  return Response.json({ ok: true });
}

// 更新（ステータス変更）
export async function PUT(req: Request) {
  const body = await req.json();

  await prisma.tasks.update({
    where: { id: body.id },
    data: {
      status: body.status,
    },
  });

  return Response.json({ ok: true });
}