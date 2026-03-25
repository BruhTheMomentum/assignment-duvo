import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const TOKENS_DIR = path.join(DATA_DIR, "tokens");

const GOOGLE_SCOPES = [
	"https://www.googleapis.com/auth/drive",
	"https://www.googleapis.com/auth/documents",
	"https://www.googleapis.com/auth/spreadsheets",
	"https://www.googleapis.com/auth/presentations",
	"https://www.googleapis.com/auth/calendar",
];

export type GoogleTokens = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expiry_date: number;
};

function getClientId(): string {
	const id = process.env.GOOGLE_CLIENT_ID;
	if (!id) throw new Error("GOOGLE_CLIENT_ID not set");
	return id;
}

function getClientSecret(): string {
	const secret = process.env.GOOGLE_CLIENT_SECRET;
	if (!secret) throw new Error("GOOGLE_CLIENT_SECRET not set");
	return secret;
}

function getRedirectUri(): string {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	return `${base}/api/auth/google/callback`;
}

export function generateUserId(): string {
	return crypto.randomUUID();
}

export function buildAuthUrl(userId: string): string {
	const params = new URLSearchParams({
		client_id: getClientId(),
		redirect_uri: getRedirectUri(),
		response_type: "code",
		scope: GOOGLE_SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state: userId,
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
	code: string,
): Promise<GoogleTokens> {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: getClientId(),
			client_secret: getClientSecret(),
			redirect_uri: getRedirectUri(),
			grant_type: "authorization_code",
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	const data = await response.json();
	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		token_type: data.token_type ?? "Bearer",
		expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
	};
}

export function getTokenPath(userId: string): string {
	const safeId = userId.replace(/[^a-zA-Z0-9-]/g, "");
	return path.join(TOKENS_DIR, `${safeId}.json`);
}

export async function saveUserTokens(
	userId: string,
	tokens: GoogleTokens,
): Promise<void> {
	await mkdir(TOKENS_DIR, { recursive: true });
	const tokenPath = getTokenPath(userId);
	await writeFile(tokenPath, JSON.stringify(tokens, null, 2));
}

export async function getUserTokens(
	userId: string,
): Promise<GoogleTokens | null> {
	try {
		const tokenPath = getTokenPath(userId);
		const content = await readFile(tokenPath, "utf-8");
		return JSON.parse(content) as GoogleTokens;
	} catch {
		return null;
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

export function getOAuthCredentialsPath(): string {
	return path.join(DATA_DIR, "gcp-oauth.keys.json");
}

export async function ensureOAuthCredentialsFile(): Promise<void> {
	const credPath = getOAuthCredentialsPath();
	const exists = await fileExists(credPath);
	if (exists) return;

	await mkdir(DATA_DIR, { recursive: true });
	const credentials = {
		installed: {
			client_id: getClientId(),
			client_secret: getClientSecret(),
			redirect_uris: [getRedirectUri()],
		},
	};
	await writeFile(credPath, JSON.stringify(credentials, null, 2));
}

export async function deleteUserTokens(userId: string): Promise<void> {
	const { unlink } = await import("node:fs/promises");
	try {
		await unlink(getTokenPath(userId));
	} catch {
		// Token file may not exist
	}
}
