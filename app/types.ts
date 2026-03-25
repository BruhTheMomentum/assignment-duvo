export type Step = {
	type: "assistant_text" | "tool_call" | "tool_result";
	timestamp: number;
	text?: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolUseId?: string;
	toolOutput?: string;
	isError?: boolean;
};

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	steps: Step[];
	csv: { filename: string; content: string } | null;
	timestamp: number;
};

export type ChatSession = {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
};

export type ChatState = {
	response: string;
	error: string | null;
	csv: { filename: string; content: string } | null;
	steps: Step[];
};
