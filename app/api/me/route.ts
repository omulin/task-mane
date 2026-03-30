import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { id: null, name: null, email: null, role: null },
      { status: 401 }
    );
  }

  const existingUser = await prisma.users.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (existingUser) {
    return Response.json(existingUser);
  }

  const createdUser = await prisma.users.create({
    data: {
      name: session.user.name || session.user.email.split("@")[0] || "no-name",
      email: session.user.email,
      password: "google",
      role: "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return Response.json(createdUser);
}