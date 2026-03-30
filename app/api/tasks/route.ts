import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json([], { status: 401 });
  }

  const user = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return Response.json([]);

  let tasks;

  if (user.role === "STAFF") {
    tasks = await prisma.tasks.findMany({
      orderBy: { id: "desc" },
    });
  } else {
    tasks = await prisma.tasks.findMany({
      where: { createdById: user.id },
      orderBy: { id: "desc" },
    });
  }

  return Response.json(tasks);
}

/* ===== POST（作成） ===== */
export async function POST(req: Request) {
  const body = await req.json();

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  let currentUser = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) {
    currentUser = await prisma.users.create({
      data: {
        name: session.user.name || "no-name",
        email: session.user.email,
        password: "google",
        role: "USER",
      },
    });
  }

  const task = await prisma.tasks.create({
    data: {
      title: body.title,
      status: "TODO",
      approval: "PENDING",
      assigneeId: currentUser.id,
      createdById: currentUser.id,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      week: 3,
    },
  });

  return Response.json(task);
}

/* ===== DELETE（削除） ===== */
export async function DELETE(req: Request) {
  const body = await req.json();

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const task = await prisma.tasks.findUnique({
    where: { id: body.id },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (user.role !== "STAFF" && task.createdById !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tasks.delete({
    where: { id: body.id },
  });

  return Response.json({ ok: true });
}

/* ===== PUT（更新） ===== */
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