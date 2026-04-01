"use client";

import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unwrapApiResult } from "@/features/operator-operations/lib/operator-operations.helpers";
import type { OperatorContext } from "@/features/operator-operations/models/operator-operations.types";
import { authClient } from "@/server/better-auth/client";
import { eden } from "@/server/eden";

interface SetupScreenProps {
	userName: string | null;
}

export function SetupScreen({ userName }: SetupScreenProps) {
	const queryClient = useQueryClient();
	const [tenantName, setTenantName] = useState("");
	const [initialLotName, setInitialLotName] = useState("");
	const [initialBaseRate, setInitialBaseRate] = useState("50");
	const logoutMutation = useMutation({
		mutationFn: async () => {
			await authClient.signOut();
		},
	});

	const bootstrapMutation = useMutation({
		mutationFn: async () => {
			const trimmedTenant = tenantName.trim();
			const trimmedLot = initialLotName.trim();
			const rate = Number(initialBaseRate);

			if (trimmedTenant.length < 2)
				throw new Error("Organization name must be at least 2 characters.");
			if (trimmedLot.length < 2)
				throw new Error("Parking lot name must be at least 2 characters.");
			if (!Number.isFinite(rate) || rate < 0)
				throw new Error("Base rate must be a valid non-negative number.");

			return unwrapApiResult<OperatorContext>(
				await eden.operator.bootstrap.post({
					baseRate: rate,
					initialLotName: trimmedLot,
					tenantName: trimmedTenant,
				}),
			);
		},
		onError: (error) => {
			toast.danger(error instanceof Error ? error.message : "Setup failed.", {
				timeout: 2000,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["operator-context"] });
		},
	});

	return (
		<main className="safe-top safe-bottom flex min-h-dvh flex-col bg-background">
			<div className="flex flex-1 flex-col px-6 py-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<p className="text-muted-foreground text-sm">
							Welcome{userName ? `, ${userName}` : ""}
						</p>
						<h1 className="mt-1 font-bold text-2xl tracking-tight">
							Set up workspace
						</h1>
					</div>
					<Button
						className="rounded-xl text-muted-foreground"
						onClick={() => logoutMutation.mutate()}
						size="sm"
						variant="ghost"
					>
						Log out
					</Button>
				</div>

				{/* Setup card */}
				<div className="mt-8 flex-1">
					<div className="rounded-3xl bg-card p-6 ring-1 ring-border">
						<p className="font-medium text-foreground">
							Create your organization and first parking lot to get started.
						</p>

						<form
							className="mt-6 flex flex-col gap-4"
							onSubmit={(event) => {
								event.preventDefault();
								bootstrapMutation.mutate();
							}}
						>
							<div>
								<label
									className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
									htmlFor="tenant-name"
								>
									Organization name
								</label>
								<Input
									className="h-13 rounded-2xl bg-secondary px-4 text-base"
									id="tenant-name"
									minLength={2}
									onChange={(event) => setTenantName(event.target.value)}
									placeholder="Downtown Parking Ops"
									required
									value={tenantName}
								/>
							</div>

							<div>
								<label
									className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
									htmlFor="lot-name"
								>
									First parking lot
								</label>
								<Input
									className="h-13 rounded-2xl bg-secondary px-4 text-base"
									id="lot-name"
									minLength={2}
									onChange={(event) => setInitialLotName(event.target.value)}
									placeholder="North Gate"
									required
									value={initialLotName}
								/>
							</div>

							<div>
								<label
									className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
									htmlFor="base-rate"
								>
									Base rate (INR)
								</label>
								<Input
									className="h-13 rounded-2xl bg-secondary px-4 text-base"
									id="base-rate"
									min="0"
									onChange={(event) => setInitialBaseRate(event.target.value)}
									required
									step="1"
									type="number"
									value={initialBaseRate}
								/>
							</div>

							<Button
								className="mt-2 h-13 rounded-2xl font-semibold text-base"
								disabled={bootstrapMutation.isPending}
								size="lg"
								type="submit"
							>
								{bootstrapMutation.isPending
									? "Creating workspace..."
									: "Create workspace"}
							</Button>
						</form>
					</div>
				</div>
			</div>
		</main>
	);
}
