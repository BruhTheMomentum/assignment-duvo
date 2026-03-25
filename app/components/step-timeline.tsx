"use client";

import { useState } from "react";
import type { Step } from "@/app/types";

function StepItem({ step }: { step: Step }) {
	const [expanded, setExpanded] = useState(false);

	if (step.type === "assistant_text") {
		return (
			<div className="pl-4 border-l-2 border-muted-foreground/20 py-1">
				<p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
					{step.text}
				</p>
			</div>
		);
	}

	if (step.type === "tool_call") {
		return (
			<div className="pl-4 border-l-2 border-blue-500/40 py-1">
				<button
					type="button"
					onClick={() => setExpanded((prev) => !prev)}
					className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
				>
					<span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/20">
						{step.toolName}
					</span>
					<span className="text-muted-foreground">
						{expanded ? "▼" : "▶"} input
					</span>
				</button>
				{expanded && step.toolInput && (
					<pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto font-mono">
						{JSON.stringify(step.toolInput, null, 2)}
					</pre>
				)}
			</div>
		);
	}

	if (step.type === "tool_result") {
		const output = step.toolOutput ?? "";
		const truncated = output.length > 300;
		const displayText = expanded ? output : output.slice(0, 300);

		return (
			<div
				className={`pl-4 border-l-2 py-1 ${step.isError ? "border-red-500/40" : "border-green-500/40"}`}
			>
				<span
					className={`text-xs font-medium ${step.isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
				>
					{step.isError ? "✗ error" : "✓ result"}
				</span>
				<pre
					className={`mt-1 rounded p-2 text-xs overflow-x-auto font-mono ${step.isError ? "bg-red-500/5" : "bg-muted"}`}
				>
					{displayText}
					{truncated && !expanded && "..."}
				</pre>
				{truncated && (
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						className="text-xs text-muted-foreground hover:text-foreground mt-1"
					>
						{expanded ? "Show less" : "Show more"}
					</button>
				)}
			</div>
		);
	}

	return null;
}

export function StepTimeline({ steps }: { steps: Step[] }) {
	const [visible, setVisible] = useState(false);

	if (steps.length === 0) return null;

	return (
		<div className="space-y-1">
			<button
				type="button"
				onClick={() => setVisible((prev) => !prev)}
				className="text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				{visible ? "▼ Hide" : "▶ Show"} {steps.length} step
				{steps.length === 1 ? "" : "s"}
			</button>
			{visible && (
				<div className="space-y-1 mt-1">
					{steps.map((step, i) => (
						<StepItem key={`${step.type}-${step.toolUseId ?? i}`} step={step} />
					))}
				</div>
			)}
		</div>
	);
}
