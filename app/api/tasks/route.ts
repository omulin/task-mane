import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const MANAGEMENT_ROLES = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];
const ALLOWED_STATUS = ["TODO", "DOING", "DONE"] as const;

function canManageAllTasks(role: string) {
  return MANAGEMENT_ROLES.includes(role);
}

function canTouchTask(
  currentUser: { id: number; role: string },
  task: { createdById: number; assigneeId: number }
) {
  return (
    canManageAllTasks(currentUser.role) ||
    task.createdById === currentUser.id ||
    task.assigneeId === currentUser.id
  );
}

function isValidStatus(
  status: string
): status is (typeof ALLOWED_STATUS)[number] {
  return ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number]);
}

function normalizeTitle(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLabel(value: unknown) {
  const label = String(value ?? "").trim();
  return label === "" ? null : label.slice(0, 50);
}

function isValidHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function parseDateInput(value: unknown): { ok: boolean; value: Date | null } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { ok: false, value: null };
  }

  return { ok: true, value: date };
}

const taskInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
    },
  },
  doneBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
    },
  },
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json([], { status: 401 });
  }

  const currentUser = await prisma.users.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) {
    return Response.json([]);
  }

  const tasks = canManageAllTasks(currentUser.role)
    ? await prisma.tasks.findMany({
        orderBy: { id: "desc" },
        include: taskInclude,
      })
    : await prisma.tasks.findMany({
        where: {
          OR: [{ createdById: currentUser.id }, { assigneeId: currentUser.id }],
        },
        orderBy: { id: "desc" },
        include: taskInclude,
      });

  return Response.json(tasks);
}

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

  const title = normalizeTitle(body.title);
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const parsedStart = parseDateInput(body.startDate);
  const parsedEnd = parseDateInput(body.endDate);

  if (!parsedStart.ok || !parsedEnd.ok) {
    return Response.json({ error: "invalid date" }, { status: 400 });
  }

  if (parsedStart.value && parsedEnd.value && parsedStart.value > parsedEnd.value) {
    return Response.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 }
    );
  }

  let assigneeId = currentUser.id;

  if (body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== "") {
    const nextAssigneeId = Number(body.assigneeId);

    if (Number.isNaN(nextAssigneeId)) {
      return Response.json({ error: "invalid assigneeId" }, { status: 400 });
    }

    if (!canManageAllTasks(currentUser.role) && nextAssigneeId !== currentUser.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignee = await prisma.users.findUnique({
      where: { id: nextAssigneeId },
    });

    if (!assignee) {
      return Response.json({ error: "Assignee not found" }, { status: 404 });
    }

    assigneeId = nextAssigneeId;
  }

  const color =
    typeof body.color === "string" && isValidHexColor(body.color)
      ? body.color
      : "#4a90e2";

  const task = await prisma.tasks.create({
    data: {
      title,
      label: normalizeLabel(body.label),
      color,
      status: "TODO",
      approval: "PENDING",
      assigneeId,
      createdById: currentUser.id,
      doneById: null,
      completedAt: null,
      startDate: parsedStart.value,
      endDate: parsedEnd.value,
      week: 3,
    },
    include: taskInclude,
  });

  return Response.json(task);
}

export async function DELETE(req: Request) {
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

  const id = Number(body.id);
  if (Number.isNaN(id)) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const task = await prisma.tasks.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      assigneeId: true,
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!canTouchTask(currentUser, task)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tasks.delete({
    where: { id },
  });

  return Response.json({ ok: true });
}

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

  const id = Number(body.id);
  if (Number.isNaN(id)) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const task = await prisma.tasks.findUnique({
    where: { id },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!canTouchTask(currentUser, task)) {
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
    completedAt?: Date | null;
    doneById?: number | null;
  } = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = normalizeTitle(body.title);
    if (!title) {
      return Response.json({ error: "title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "label")) {
    data.label = normalizeLabel(body.label);
  }

  if (Object.prototype.hasOwnProperty.call(body, "color")) {
    const color = String(body.color ?? "").trim();
    if (color && !isValidHexColor(color)) {
      return Response.json({ error: "invalid color" }, { status: 400 });
    }
    data.color = color || "#4a90e2";
  }

  if (Object.prototype.hasOwnProperty.call(body, "startDate")) {
    const parsed = parseDateInput(body.startDate);
    if (!parsed.ok) {
      return Response.json({ error: "invalid startDate" }, { status: 400 });
    }
    data.startDate = parsed.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "endDate")) {
    const parsed = parseDateInput(body.endDate);
    if (!parsed.ok) {
      return Response.json({ error: "invalid endDate" }, { status: 400 });
    }
    data.endDate = parsed.value;
  }

  const nextStartDate =
    Object.prototype.hasOwnProperty.call(data, "startDate")
      ? data.startDate ?? null
      : task.startDate;

  const nextEndDate =
    Object.prototype.hasOwnProperty.call(data, "endDate")
      ? data.endDate ?? null
      : task.endDate;

  if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
    return Response.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 }
    );
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!isValidStatus(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }

    data.status = body.status;

    if (body.status === "DONE") {
      if (task.status !== "DONE") {
        data.completedAt = new Date();
        data.doneById = currentUser.id;
      }
    } else {
      if (task.status === "DONE") {
        data.completedAt = null;
        data.doneById = null;
      }
    }
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
    where: { id },
    data,
    include: taskInclude,
  });

  return Response.json(updatedTask);
}