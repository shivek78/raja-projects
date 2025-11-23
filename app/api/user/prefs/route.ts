import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { verifyJwt } from "@/lib/jwt";

export async function POST(req: Request) {
  await connectDB();

  const body = await req.json();

  // Read token from cookies
  const token = req.headers
    .get("cookie")
    ?.split("token=")[1]
    ?.split(";")[0];

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyJwt(token);

  await User.findByIdAndUpdate(payload.id, {
    theme: body.theme,
  });

  return Response.json({ success: true });
}
