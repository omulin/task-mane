import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const CAN_MANAGE_TEAM_ROLES = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"];

function canManageSubTeams(role: string) {
  return CAN_MANAGE_TEAM_ROLES.includes(role);
}

export async function GET(req: Request) {
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

  if (!canManageSubTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const teamIdParam = searchParams.get("teamId");

  const where =
    teamIdParam && !Number.isNaN(Number(teamIdParam))
      ? { teamId: Number(teamIdParam) }
      : undefined;

  const subTeams = await prisma.subTeams.findMany({
    where,
    orderBy: [{ teamId: "asc" }, { id: "asc" }],
    include: {
      team: true,
      _count: {
        select: {
          users: true,
        },
      },
    },
  });

  return Response.json(subTeams);
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

  if (!canManageSubTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const teamId = Number(body.teamId);

  if (!name) {
    return Response.json({ error: "Sub team name is required" }, { status: 400 });
  }

  if (Number.isNaN(teamId)) {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  const team = await prisma.teams.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  const existingSubTeam = await prisma.subTeams.findFirst({
    where: {
      name,
      teamId,
    },
  });

  if (existingSubTeam) {
    return Response.json(
      { error: "Sub team name already exists in this team" },
      { status: 400 }
    );
  }

  const subTeam = await prisma.subTeams.create({
    data: {
      name,
      teamId,
      createdById: currentUser.id,
    },
  });

  return Response.json(subTeam);
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

  if (!canManageSubTeams(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (typeof body.id !== "number") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();

  if (!name) {
    return Response.json({ error: "Sub team name is required" }, { status: 400 });
  }

  const subTeam = await prisma.subTeams.findUnique({
    where: { id: body.id },
  });

  if (!subTeam) {
    return Response.json({ error: "Sub team not found" }, { status: 404 });
  }

  const duplicated = await prisma.subTeams.findFirst({
    where: {
      teamId: subTeam.teamId,
      name,
      NOT: { id: body.id },
    },
  });

  if (duplicated) {
    return Response.json(
      { error: "Sub team name already exists in this team" },
      { status: 400 }
    );
  }

  const updatedSubTeam = await prisma.subTeams.update({
    where: { id: body.id },
    data: { name },
  });

  return Response.json(updatedSubTeam);
}