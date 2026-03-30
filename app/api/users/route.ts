import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const ALLOWED_ROLES = [
  "USER",
  "STAFF",
  "MANAGER",
  "DIRECTOR",
  "AREA",
  "ADMIN",
] as const;

type RoleValue = (typeof ALLOWED_ROLES)[number];

function isValidRole(role: string): role is RoleValue {
  return ALLOWED_ROLES.includes(role as RoleValue);
}

/* ===== GET（一覧） ===== */
export async function GET() {
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

  if (currentUser.role !== "STAFF") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(users);
}

/* ===== POST（作成） ===== */
export async function POST(req: Request) {
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

  if (currentUser.role !== "STAFF") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (!body.name || !body.email) {
    return Response.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const role: RoleValue = isValidRole(body.role) ? body.role : "USER";

  const user = await prisma.users.create({
    data: {
      name: body.name,
      email: body.email,
      password: body.password || "1234",
      role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(user);
}

/* ===== PATCH（権限変更） ===== */
export async function PATCH(req: Request) {
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

  if (currentUser.role !== "STAFF") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (typeof body.id !== "number") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  if (!isValidRole(body.role)) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }

  const updatedUser = await prisma.users.update({
    where: { id: body.id },
    data: {
      role: body.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(updatedUser);
}