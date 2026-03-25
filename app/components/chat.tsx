"use client";

import { useActionState, useRef, useEffect, useState, useMemo } from "react";
import { chat } from "@/app/actions";
import type { ChatState, ChatMessage, ChatSession } from "@/app/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StepTimeline } from "@/app/components/step-timeline";

const initialState: ChatState = {
	response: "",
	error: null,
	csv: null,
	steps: [],
};

function MessageBubble({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";

	const csvUrl = useMemo(() => {
		if (!message.csv) return null;
		return URL.createObjectURL(
			new Blob([message.csv.content], { type: "text/csv" }),
		);
	}, [message.csv]);

	useEffect(() => {
		return () => {
			if (csvUrl) URL.revokeObjectURL(csvUrl);
		};
	}, [csvUrl]);

	return (
		<div
			className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
		>
			<span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
				{isUser ? "You" : "Claude"}
			</span>
			<div
				className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
					isUser
						? "bg-foreground text-background"
						: "bg-muted/60 text-foreground"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>
			</div>
			{!isUser && message.steps.length > 0 && (
				<div className="max-w-[85%] w-full">
					<StepTimeline steps={message.steps} />
				</div>
			)}
			{csvUrl && message.csv && (
				<a
					href={csvUrl}
					download={message.csv.filename}
					className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
				>
					Download {message.csv.filename}
				</a>
			)}
		</div>
	);
}

export function Chat({
	activeSession,
	sessions,
	activeSessionId,
	onSessionUpdate,
	onSelectSession,
	onNewChat,
	onClearAll,
}: {
	activeSession: ChatSession | null;
	sessions: ChatSession[];
	activeSessionId: string | null;
	onSessionUpdate: (userMessage: string, state: ChatState) => void;
	onSelectSession: (id: string) => void;
	onNewChat: () => void;
	onClearAll: () => void;
}) {
	const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
		null,
	);
	const [state, formAction, pending] = useActionState(chat, initialState);
	const formRef = useRef<HTMLFormElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [activeSession, pending]);

	useEffect(() => {
		if (pending || !pendingUserMessage) return;
		if (!state.response && !state.error) return;

		onSessionUpdate(pendingUserMessage, state);
		setPendingUserMessage(null);
	}, [pending, state, pendingUserMessage, onSessionUpdate]);

	const handleSubmit = (formData: FormData) => {
		const message = (formData.get("message") as string)?.trim();
		if (!message) return;
		setPendingUserMessage(message);
		formAction(formData);

		if (formRef.current) {
			const textarea = formRef.current.querySelector("textarea");
			if (textarea) textarea.value = "";
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	};

	const hasMessages =
		(activeSession && activeSession.messages.length > 0) ||
		(pending && pendingUserMessage);

	return (
		<div className="flex flex-col gap-6">
			{/* Messages area */}
			{hasMessages && (
				<div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-border/40 bg-card p-5">
					{activeSession?.messages.map((msg) => (
						<MessageBubble key={msg.id} message={msg} />
					))}

					{pending && pendingUserMessage && (
						<>
							<div className="flex flex-col gap-1 items-end">
								<span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
									You
								</span>
								<div className="rounded-2xl px-4 py-3 text-sm max-w-[85%] bg-foreground text-background">
									<p className="whitespace-pre-wrap">{pendingUserMessage}</p>
								</div>
							</div>
							<div className="flex flex-col gap-1 items-start">
								<span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
									Claude
								</span>
								<div className="rounded-2xl px-4 py-3 text-sm bg-muted/60 animate-pulse">
									Thinking...
								</div>
							</div>
						</>
					)}

					<div ref={messagesEndRef} />
				</div>
			)}

			{/* Previous tasks */}
			{sessions.length > 0 && (
				<div className="flex items-center gap-2 flex-wrap">
					{sessions.map((session) => (
						<button
							key={session.id}
							type="button"
							onClick={() => onSelectSession(session.id)}
							className={`text-xs rounded-full px-3 py-1.5 transition-all truncate max-w-[180px] ${
								session.id === activeSessionId
									? "bg-foreground text-background shadow-sm"
									: "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
							}`}
						>
							{session.title}
						</button>
					))}
					<button
						type="button"
						onClick={onNewChat}
						className="text-xs rounded-full px-3 py-1.5 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
					>
						+ New
					</button>
					<button
						type="button"
						onClick={onClearAll}
						className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors ml-auto"
					>
						Clear all
					</button>
				</div>
			)}

			{/* Input */}
			<form
				ref={formRef}
				action={handleSubmit}
				className="flex gap-3 items-end"
			>
				<div className="flex-1 relative">
					<Textarea
						name="message"
						placeholder="Ask anything..."
						required
						disabled={pending}
						onKeyDown={handleKeyDown}
						className="min-h-12 resize-none rounded-2xl border-border/40 bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-ring/30"
						rows={1}
					/>
				</div>
				<Button
					type="submit"
					disabled={pending}
					size="lg"
					className="rounded-2xl h-12 px-6"
				>
					{pending ? "..." : "Send"}
				</Button>
			</form>
		</div>
	);
}
