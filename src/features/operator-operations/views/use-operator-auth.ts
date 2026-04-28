"use client";

import { useEffect, useMemo, useState } from "react";
import {
	initSchemaIfNeeded,
	loadAuthSnapshot,
	loadLastActiveUserId,
	saveAuthSnapshot,
	saveLastActiveUserId,
	setSyncPaused,
} from "@/features/operator-operations/sync/operator.store";
import { authClient } from "@/server/better-auth/client";

/**
 * When offline, Better Auth's session fetch can stay pending indefinitely.
 * We hydrate role from IndexedDB and surface a synthetic session so the operator shell can load.
 */
export function useOperatorAuth() {
	const sessionState = authClient.useSession();
	const [offlineAuth, setOfflineAuth] =
		useState<Awaited<ReturnType<typeof loadAuthSnapshot>>>(undefined);
	/** False only on the client while offline and we have not finished reading idb auth snapshot. */
	const [offlineAuthReady, setOfflineAuthReady] = useState(
		() =>
			typeof globalThis.navigator === "undefined" ||
			globalThis.navigator.onLine,
	);

	useEffect(() => {
		void initSchemaIfNeeded();
	}, []);

	useEffect(() => {
		const u = sessionState.data?.user;
		if (u?.id) {
			void saveLastActiveUserId(u.id);
			void saveAuthSnapshot({
				email: u.email ?? "",
				name: u.name ?? null,
				updatedAt: new Date().toISOString(),
				userId: u.id,
			});
			void setSyncPaused(u.id, false);
		}
	}, [sessionState.data?.user]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const hydrateFromIdbWhenOffline = () => {
			if (navigator.onLine) {
				setOfflineAuth(undefined);
				setOfflineAuthReady(true);
				return;
			}
			setOfflineAuthReady(false);
			void (async () => {
				try {
					await initSchemaIfNeeded();
					const uid = await loadLastActiveUserId();
					if (!uid) {
						setOfflineAuth(undefined);
						return;
					}
					const snap = await loadAuthSnapshot(uid);
					setOfflineAuth(snap ?? undefined);
				} finally {
					setOfflineAuthReady(true);
				}
			})();
		};

		hydrateFromIdbWhenOffline();
		window.addEventListener("online", hydrateFromIdbWhenOffline);
		window.addEventListener("offline", hydrateFromIdbWhenOffline);
		return () => {
			window.removeEventListener("online", hydrateFromIdbWhenOffline);
			window.removeEventListener("offline", hydrateFromIdbWhenOffline);
		};
	}, []);

	return useMemo(() => {
		if (sessionState.data?.session && sessionState.data.user) {
			return sessionState;
		}

		if (typeof navigator === "undefined" || navigator.onLine) {
			return sessionState;
		}

		if (!offlineAuthReady) {
			return {
				...sessionState,
				isPending: true,
			};
		}

		if (offlineAuth?.userId) {
			return {
				...sessionState,
				error: null,
				isPending: false,
				isRefetching: false,
				data: {
					session: {
						expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
						id: "offline",
						token: "offline",
					},
					user: {
						email: offlineAuth.email,
						emailVerified: true,
						id: offlineAuth.userId,
						image: null,
						name: offlineAuth.name,
					},
				},
			};
		}

		return {
			...sessionState,
			isPending: false,
			data: null,
		};
	}, [offlineAuth, offlineAuthReady, sessionState]);
}
