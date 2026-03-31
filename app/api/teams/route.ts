import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const CAN_MANAGE_TEAM_ROLES = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];

function canManageTeams(role: string) {
  return CAN_MANAGE_TEAM_ROLES.includes(role);
}

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

  if (!canManageTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await prisma.teams.findMany({
    orderBy: { id: "asc" },
    include: {
      subTeams: {
        orderBy: { id: "asc" },
      },
      _count: {
        select: {
          users: true,
          subTeams: true,
        },
      },
    },
  });

  return Response.json(teams);
}

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

  if (!canManageTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();

  if (!name) {
    return Response.json({ error: "Team name is required" }, { status: 400 });
  }

  const existingTeam = await prisma.teams.findFirst({
    where: { name },
  });

  if (existingTeam) {
    return Response.json({ error: "Team name already exists" }, { status: 400 });
  }

  const team = await prisma.teams.create({
    data: {
      name,
      createdById: currentUser.id,
    },
  });

  return Response.json(team);
}

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

  if (!canManageTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (typeof body.id !== "number") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();

  if (!name) {
    return Response.json({ error: "Team name is required" }, { status: 400 });
  }

  const team = await prisma.teams.findUnique({
    where: { id: body.id },
  });

  if (!team) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  const duplicated = await prisma.teams.findFirst({
    where: {
      name,
      NOT: { id: body.id },
    },
  });

  if (duplicated) {
    return Response.json({ error: "Team name already exists" }, { status: 400 });
  }

  const updatedTeam = await prisma.teams.update({
    where: { id: body.id },
    data: { name },
  });

  return Response.json(updatedTeam);
}