import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const CAN_MANAGE_ALL_TASKS = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];
const ALLOWED_STATUS = ["TODO", "DOING", "DONE"] as const;

function canManageAllTasks(role: string) {
  return CAN_MANAGE_ALL_TASKS.includes(role);
}

function isValidStatus(status: string): status is (typeof ALLOWED_STATUS)[number] {
  return ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number]);
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json([], { status: 401 });
  }

  const user = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return Response.json([]);

  const tasks = canManageAllTasks(user.role)
    ? await prisma.tasks.findMany({
        orderBy: { id: "desc" },
      })
    : await prisma.tasks.findMany({
        where: { createdById: user.id },
        orderBy: { id: "desc" },
      });

  return Response.json(tasks);
}

/* ===== POST（作成） ===== */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

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

  const title = String(body.title ?? "").trim();

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const task = await prisma.tasks.create({
    data: {
      title,
      label: body.label ? String(body.label).trim() : null,
      color: body.color ? String(body.color) : "#4a90e2",
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
  const body = await req.json().catch(() => ({}));

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

  if (!canManageAllTasks(user.role) && task.createdById !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tasks.delete({
    where: { id: body.id },
  });

  return Response.json({ ok: true });
}

/* ===== PUT（更新） ===== */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  const currentUser = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (typeof body.id !== "number") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const task = await prisma.tasks.findUnique({
    where: { id: body.id },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!canManageAllTasks(currentUser.role) && task.createdById !== currentUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: {
    title?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    status?: "TODO" | "DOING" | "DONE";
    label?: string | null;
    color?: string;
    assigneeId?: number;
  } = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = String(body.title ?? "").trim();
    if (!title) {
      return Response.json({ error: "title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "startDate")) {
    data.startDate = body.startDate ? new Date(body.startDate) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "endDate")) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!isValidStatus(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }

  if (Object.prototype.hasOwnProperty.call(body, "label")) {
    const label = String(body.label ?? "").trim();
    data.label = label === "" ? null : label;
  }

  if (Object.prototype.hasOwnProperty.call(body, "color")) {
    const color = String(body.color ?? "").trim();
    data.color = color === "" ? "#4a90e2" : color;
  }

  if (Object.prototype.hasOwnProperty.call(body, "assigneeId")) {
    const assigneeId = Number(body.assigneeId);

    if (Number.isNaN(assigneeId)) {
      return Response.json({ error: "invalid assigneeId" }, { status: 400 });
    }

    if (!canManageAllTasks(currentUser.role) && assigneeId !== currentUser.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignee = await prisma.users.findUnique({
      where: { id: assigneeId },
    });

    if (!assignee) {
      return Response.json({ error: "Assignee not found" }, { status: 404 });
    }

    data.assigneeId = assigneeId;
  }

  const updatedTask = await prisma.tasks.update({
    where: { id: body.id },
    data,
  });

  return Response.json(updatedTask);
}