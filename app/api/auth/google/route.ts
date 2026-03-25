import { cookies } from "next/headers";
import { buildAuthUrl, generateUserId } from "@/app/lib/google-auth";

export async function GET() {
	const cookieStore = await cookies();
	let userId = cookieStore.get("userId")?.value;

	if (!userId) {
		userId = generateUserId();
	}

	cookieStore.set("userId", userId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
	});

	const authUrl = buildAuthUrl(userId);
	return Response.redirect(authUrl);
}
