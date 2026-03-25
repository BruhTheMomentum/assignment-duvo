"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatState, ChatMessage, ChatSession } from "@/app/types";
import { Chat } from "@/app/components/chat";

const STORAGE_KEY = "chat-sessions";

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadSessions(): ChatSession[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as ChatSession[]) : [];
	} catch {
		return [];
	}
}

function saveSessions(sessions: ChatSession[]): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export default function Home() {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	useEffect(() => {
		setSessions(loadSessions());
	}, []);

	const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

	const handleSessionUpdate = useCallback(
		(userMessage: string, state: ChatState) => {
			const now = Date.now();
			const userMsg: ChatMessage = {
				id: generateId(),
				role: "user",
				content: userMessage,
				steps: [],
				csv: null,
				evaluation: null,
				timestamp: now,
			};
			const assistantMsg: ChatMessage = {
				id: generateId(),
				role: "assistant",
				content: state.error ?? state.response,
				steps: state.steps,
				csv: state.csv,
				evaluation: state.evaluation,
				timestamp: now + 1,
			};

			setSessions((prev) => {
				let updated: ChatSession[];

				if (activeSessionId) {
					updated = prev.map((s) =>
						s.id === activeSessionId
							? {
									...s,
									messages: [...s.messages, userMsg, assistantMsg],
									updatedAt: now,
								}
							: s,
					);
				} else {
					const newSession: ChatSession = {
						id: generateId(),
						title: userMessage.slice(0, 60),
						messages: [userMsg, assistantMsg],
						createdAt: now,
						updatedAt: now,
					};
					updated = [newSession, ...prev];
					setActiveSessionId(newSession.id);
				}

				saveSessions(updated);
				return updated;
			});
		},
		[activeSessionId],
	);

	const handleNewChat = useCallback(() => {
		setActiveSessionId(null);
	}, []);

	const handleSelectSession = useCallback((id: string) => {
		setActiveSessionId(id);
	}, []);

	const handleClearAll = useCallback(() => {
		setSessions([]);
		setActiveSessionId(null);
		saveSessions([]);
	}, []);

	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6">
			<div className="w-full max-w-2xl flex flex-col gap-4">
				<Chat
					activeSession={activeSession}
					sessions={sessions}
					activeSessionId={activeSessionId}
					onSessionUpdate={handleSessionUpdate}
					onSelectSession={handleSelectSession}
					onNewChat={handleNewChat}
					onClearAll={handleClearAll}
				/>
			</div>
		</div>
	);
}
