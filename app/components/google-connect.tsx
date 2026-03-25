"use client";

import { useEffect, useState, useTransition } from "react";
import { getGoogleStatus, disconnectGoogle } from "@/app/actions";

export function GoogleConnect() {
	const [connected, setConnected] = useState<boolean | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		startTransition(async () => {
			const status = await getGoogleStatus();
			setConnected(status.connected);
		});
	}, []);

	const handleDisconnect = () => {
		startTransition(async () => {
			await disconnectGoogle();
			setConnected(false);
		});
	};

	if (connected === null) return null;

	if (connected) {
		return (
			<div className="flex items-center gap-2">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
					Google connected
				</span>
				<button
					type="button"
					onClick={handleDisconnect}
					disabled={isPending}
					className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
				>
					Disconnect
				</button>
			</div>
		);
	}

	return (
		<a
			href="/api/auth/google"
			className="inline-flex items-center gap-2 rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
		>
			Connect Google
		</a>
	);
}
