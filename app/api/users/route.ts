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

const CAN_MANAGE_USERS = ["STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"] as const;

const ROLE_CHANGE_SCOPE: Record<string, string[]> = {
  STAFF: ["USER", "STAFF"],
  MANAGER: ["USER", "STAFF"],
  AREA: ["USER", "STAFF", "MANAGER"],
  DIRECTOR: ["USER", "STAFF", "MANAGER", "AREA"],
  ADMIN: ["USER", "STAFF", "MANAGER", "DIRECTOR", "AREA", "ADMIN"],
};

type RoleValue = (typeof ALLOWED_ROLES)[number];

function isValidRole(role: string): role is RoleValue {
  return ALLOWED_ROLES.includes(role as RoleValue);
}

function canManageUsers(role: string) {
  return CAN_MANAGE_USERS.includes(role as (typeof CAN_MANAGE_USERS)[number]);
}

function canAssignRole(currentRole: string, targetRole: string) {
  return ROLE_CHANGE_SCOPE[currentRole]?.includes(targetRole) ?? false;
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

  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      subTeam: {
        select: {
          id: true,
          name: true,
          teamId: true,
        },
      },
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

  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (!body.name || !body.email) {
    return Response.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const role: RoleValue = isValidRole(body.role) ? body.role : "USER";

  if (!canAssignRole(currentUser.role, role)) {
    return Response.json({ error: "You cannot assign that role" }, { status: 403 });
  }

  const user = await prisma.users.create({
    data: {
      name: body.name,
      email: body.email,
      password: body.password || "1234",
      role,
      teamId: null,
      subTeamId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      subTeam: {
        select: {
          id: true,
          name: true,
          teamId: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(user);
}

/* ===== PATCH（権限変更・所属変更） ===== */
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

  if (!canManageUsers(currentUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (typeof body.id !== "number") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const targetUser = await prisma.users.findUnique({
    where: { id: body.id },
  });

  if (!targetUser) {
    return Response.json({ error: "Target user not found" }, { status: 404 });
  }

  const data: {
    role?: RoleValue;
    teamId?: number | null;
    subTeamId?: number | null;
  } = {};

  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return Response.json({ error: "invalid role" }, { status: 400 });
    }

    if (!canAssignRole(currentUser.role, body.role)) {
      return Response.json({ error: "You cannot assign that role" }, { status: 403 });
    }

    data.role = body.role;
  }

  const hasTeamId = Object.prototype.hasOwnProperty.call(body, "teamId");
  const hasSubTeamId = Object.prototype.hasOwnProperty.call(body, "subTeamId");

  if (hasTeamId || hasSubTeamId) {
    let nextTeamId: number | null = targetUser.teamId;
    let nextSubTeamId: number | null = targetUser.subTeamId;

    if (hasTeamId) {
      if (body.teamId === null || body.teamId === "") {
        nextTeamId = null;
      } else {
        const parsedTeamId = Number(body.teamId);

        if (Number.isNaN(parsedTeamId)) {
          return Response.json({ error: "invalid teamId" }, { status: 400 });
        }

        const team = await prisma.teams.findUnique({
          where: { id: parsedTeamId },
        });

        if (!team) {
          return Response.json({ error: "Team not found" }, { status: 404 });
        }

        nextTeamId = parsedTeamId;
      }
    }

    if (hasSubTeamId) {
      if (body.subTeamId === null || body.subTeamId === "") {
        nextSubTeamId = null;
      } else {
        const parsedSubTeamId = Number(body.subTeamId);

        if (Number.isNaN(parsedSubTeamId)) {
          return Response.json({ error: "invalid subTeamId" }, { status: 400 });
        }

        const subTeam = await prisma.subTeams.findUnique({
          where: { id: parsedSubTeamId },
        });

        if (!subTeam) {
          return Response.json({ error: "Sub team not found" }, { status: 404 });
        }

        nextSubTeamId = parsedSubTeamId;

        if (!hasTeamId) {
          nextTeamId = subTeam.teamId;
        } else if (nextTeamId !== null && subTeam.teamId !== nextTeamId) {
          return Response.json(
            { error: "Selected sub team does not belong to selected team" },
            { status: 400 }
          );
        }
      }
    }

    if (nextTeamId === null) {
      nextSubTeamId = null;
    }

    if (hasTeamId && !hasSubTeamId && nextTeamId !== targetUser.teamId) {
      nextSubTeamId = null;
    }

    data.teamId = nextTeamId;
    data.subTeamId = nextSubTeamId;
  }

  const updatedUser = await prisma.users.update({
    where: { id: body.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      subTeamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      subTeam: {
        select: {
          id: true,
          name: true,
          teamId: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(updatedUser);
}