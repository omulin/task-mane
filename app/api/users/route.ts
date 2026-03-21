import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/* ===== GET（一覧） ===== */
export async function GET() {
  const users = await prisma.users.findMany({
    orderBy: {
      id: "asc",
    },
  });

  return NextResponse.json(users);
}

/* ===== POST（作成） ===== */
export async function POST(req: Request) {
  const body = await req.json();

  const user = await prisma.users.create({
    data: {
      name: body.name,
      email: body.email,
      password: body.password || "1234",
      role: body.role || "USER",
    },
  });

  return NextResponse.json(user);
}