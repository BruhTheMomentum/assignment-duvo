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
	evaluation: Evaluation | null;
	timestamp: number;
};

export type ChatSession = {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
};

export type SelfEvaluation = {
	status: "complete" | "partial" | "failed";
	summary: string;
	issues: string[];
	confidence: number;
};

export type JudgeEvaluation = {
	verdict: "pass" | "partial" | "fail";
	score: number;
	reasoning: string;
	gaps: string[];
};

export type Evaluation = {
	self: SelfEvaluation | null;
	judge: JudgeEvaluation | null;
	selfEvalSkipped: boolean;
	judgeError: string | null;
};

export type ChatState = {
	response: string;
	error: string | null;
	csv: { filename: string; content: string } | null;
	steps: Step[];
	evaluation: Evaluation | null;
};
