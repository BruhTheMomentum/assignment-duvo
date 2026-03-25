"use server";

import {
	query,
	createSdkMcpServer,
	tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import { cookies } from "next/headers";
import type { ChatState, Step } from "@/app/types";
import {
	getTokenPath,
	getOAuthCredentialsPath,
	fileExists,
	ensureOAuthCredentialsFile,
	getUserTokens,
	deleteUserTokens,
} from "@/app/lib/google-auth";

const MAX_MESSAGE_LENGTH = 10_000;

export async function getGoogleStatus(): Promise<{ connected: boolean }> {
	const cookieStore = await cookies();
	const userId = cookieStore.get("userId")?.value;
	if (!userId) return { connected: false };

	const tokens = await getUserTokens(userId);
	return { connected: tokens !== null };
}

export async function disconnectGoogle(): Promise<{ success: boolean }> {
	const cookieStore = await cookies();
	const userId = cookieStore.get("userId")?.value;
	if (!userId) return { success: false };

	await deleteUserTokens(userId);
	return { success: true };
}

function extractStepsFromContent(
	content: unknown[],
	source: "assistant" | "user",
): Step[] {
	const steps: Step[] = [];
	const now = Date.now();

	for (const block of content) {
		const b = block as Record<string, unknown>;

		if (source === "assistant") {
			if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
				steps.push({ type: "assistant_text", timestamp: now, text: b.text });
			} else if (b.type === "tool_use") {
				steps.push({
					type: "tool_call",
					timestamp: now,
					toolName: b.name as string,
					toolInput: b.input as Record<string, unknown>,
					toolUseId: b.id as string,
				});
			}
		} else if (source === "user" && b.type === "tool_result") {
			const rawContent = b.content;
			const output =
				typeof rawContent === "string"
					? rawContent
					: Array.isArray(rawContent)
						? (rawContent as Record<string, unknown>[])
								.filter((c) => c.type === "text")
								.map((c) => c.text as string)
								.join("\n")
						: "";

			steps.push({
				type: "tool_result",
				timestamp: now,
				toolUseId: b.tool_use_id as string,
				toolOutput: output,
				isError: b.is_error === true,
			});
		}
	}

	return steps;
}

export async function chat(
	prevState: ChatState,
	formData: FormData,
): Promise<ChatState> {
	const raw = formData.get("message");

	if (typeof raw !== "string" || !raw.trim()) {
		return {
			response: "",
			error: "Message cannot be empty",
			csv: null,
			steps: [],
			evaluation: null,
		};
	}

	const message = raw.trim();

	if (message.length > MAX_MESSAGE_LENGTH) {
		return {
			response: "",
			error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
			csv: null,
			steps: [],
			evaluation: null,
		};
	}

	try {
		const steps: Step[] = [];
		let capturedCsv: { filename: string; content: string } | null = null;

		const csvServer = createSdkMcpServer({
			name: "csv-tools",
			tools: [
				tool(
					"save_csv",
					"Convert structured data to a CSV file for the user to download. Call this when the user wants data exported as CSV.",
					{
						filename: z
							.string()
							.describe("Descriptive filename ending in .csv"),
						headers: z.array(z.string()).describe("Column header names"),
						rows: z
							.array(z.array(z.string()))
							.describe("Data rows, each an array of cell values"),
					},
					async (args) => {
						const csvLines = [
							args.headers.join(","),
							...args.rows.map((row) =>
								row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
							),
						];
						capturedCsv = {
							filename: args.filename,
							content: csvLines.join("\n"),
						};
						return {
							content: [
								{
									type: "text" as const,
									text: `CSV saved: ${args.filename} (${args.rows.length} rows)`,
								},
							],
						};
					},
				),
			],
		});

		const mcpServers: Record<string, unknown> = {
			"csv-tools": csvServer,
		};

		const systemPromptLines = [
			"You have tools available:",
			"- WebFetch: fetch content from URLs",
			"- save_csv: export data as a downloadable CSV file",
			"",
			"When asked to fetch data and export to CSV:",
			"1. Use WebFetch to retrieve the data",
			"2. Parse the response into a flat table structure",
			"3. Call save_csv with:",
			"   - filename: descriptive name ending in .csv",
			"   - headers: array of column names",
			"   - rows: array of arrays, each cell as a string",
			"4. Convert all values to strings (numbers, booleans, nested objects)",
			"5. Flatten nested JSON by using dot notation for column names (e.g. address.city)",
			"",
			"Never output raw CSV text. Always use save_csv.",
		];

		const allowedTools = ["WebFetch", "mcp__csv-tools__save_csv"];

		const cookieStore = await cookies();
		const userId = cookieStore.get("userId")?.value;

		if (userId) {
			const tokenPath = getTokenPath(userId);
			const hasTokens = await fileExists(tokenPath);
			if (hasTokens) {
				await ensureOAuthCredentialsFile();
				mcpServers["google-drive"] = {
					command: "npx",
					args: ["-y", "@piotr-agier/google-drive-mcp"],
					env: {
						GOOGLE_DRIVE_OAUTH_CREDENTIALS: getOAuthCredentialsPath(),
						GOOGLE_DRIVE_MCP_TOKEN_PATH: tokenPath,
					},
				};
				systemPromptLines.push(
					"",
					"You also have access to Google Drive, Docs, Sheets, Slides, and Calendar tools.",
					"Use these when the user asks to interact with their Google Workspace.",
				);
			}
		}

		const q = query({
			prompt: message,
			options: {
				systemPrompt: systemPromptLines.join("\n"),
				allowedTools,
				maxTurns: 5,
				persistSession: false,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				mcpServers: mcpServers as any,
			},
		});

		for await (const msg of q) {
			if (msg.type === "assistant") {
				const assistantMsg = msg as Record<string, unknown>;
				const betaMessage = assistantMsg.message as
					| Record<string, unknown>
					| undefined;
				if (betaMessage?.content && Array.isArray(betaMessage.content)) {
					steps.push(
						...extractStepsFromContent(betaMessage.content, "assistant"),
					);
				}
			} else if (msg.type === "user") {
				const userMsg = msg as Record<string, unknown>;
				const messageParam = userMsg.message as
					| Record<string, unknown>
					| undefined;
				if (messageParam?.content && Array.isArray(messageParam.content)) {
					steps.push(...extractStepsFromContent(messageParam.content, "user"));
				}
			} else if (msg.type === "result") {
				if (msg.subtype === "success") {
					return {
						response: msg.result,
						error: null,
						csv: capturedCsv,
						steps,
						evaluation: null,
					};
				}

				return {
					response: "",
					error:
						"errors" in msg
							? msg.errors.join(", ") || "An error occurred"
							: "An error occurred",
					csv: null,
					steps,
					evaluation: null,
				};
			}
		}

		return {
			response: "",
			error: "No response received",
			csv: null,
			steps,
			evaluation: null,
		};
	} catch (error) {
		console.error("Chat action failed:", error);
		return {
			response: "",
			error: "Something went wrong. Please try again.",
			csv: null,
			steps: [],
			evaluation: null,
		};
	}
}
