import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import User from "@/lib/models/User";
import { connectDB } from "@/lib/db";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET(req: Request) {
  try {
    await connectDB();

    const token = req.headers
      .get("cookie")
      ?.split("; ")
      ?.find((x) => x.startsWith("token="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const { payload } = await jwtVerify(token, secretKey);
    const user = await User.findById(payload.id).lean();

    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ user: null });
  }
}
