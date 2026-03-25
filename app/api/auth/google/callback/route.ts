import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {
	exchangeCodeForTokens,
	saveUserTokens,
	ensureOAuthCredentialsFile,
} from "@/app/lib/google-auth";

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	const state = request.nextUrl.searchParams.get("state");
	const error = request.nextUrl.searchParams.get("error");

	if (error) {
		const url = new URL("/", request.url);
		url.searchParams.set("auth_error", error);
		return Response.redirect(url.toString());
	}

	if (!code || !state) {
		return new Response("Missing code or state", { status: 400 });
	}

	const cookieStore = await cookies();
	const userId = cookieStore.get("userId")?.value;

	if (!userId || userId !== state) {
		return new Response("Invalid state parameter", { status: 403 });
	}

	try {
		const tokens = await exchangeCodeForTokens(code);
		await saveUserTokens(userId, tokens);
		await ensureOAuthCredentialsFile();

		return Response.redirect(new URL("/", request.url).toString());
	} catch (err) {
		console.error("OAuth callback failed:", err);
		const url = new URL("/", request.url);
		url.searchParams.set("auth_error", "token_exchange_failed");
		return Response.redirect(url.toString());
	}
}
