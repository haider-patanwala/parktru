"use client";

import { EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/better-auth/client";

interface AuthScreenProps {
	onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
	const sessionState = authClient.useSession();
	const [isSignUpMode, setIsSignUpMode] = useState(false);
	const [authName, setAuthName] = useState("");
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const authMutation = useMutation({
		mutationFn: async () => {
			if (isSignUpMode) {
				const result = await authClient.signUp.email({
					email: authEmail,
					name: authName,
					password: authPassword,
				});

				if (result.error) {
					throw new Error(
						result.error.message ??
							result.error.statusText ??
							"Sign up failed.",
					);
				}
			} else {
				const result = await authClient.signIn.email({
					email: authEmail,
					password: authPassword,
				});

				if (result.error) {
					throw new Error(
						result.error.message ??
							result.error.statusText ??
							"Sign in failed.",
					);
				}
			}

			await sessionState.refetch();
		},
		onSuccess: () => {
			onAuthenticated();
		},
		onError: (error) => {
			toast.danger(
				error instanceof Error ? error.message : "Authentication failed.",
				{ timeout: 2000 },
			);
		},
	});

	return (
		<main className="safe-top safe-bottom flex min-h-dvh flex-col bg-background">
			<div className="flex flex-1 flex-col justify-center px-6 py-12">
				{/* Logo / Brand */}
				<div className="mb-10 text-center">
					<div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/15">
						<span className="font-bold text-2xl text-primary">P</span>
					</div>
					<h1 className="font-bold text-3xl tracking-tight">ParkTru</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Fast parking management for operators
					</p>
				</div>

				{/* Mode toggle */}
				<div className="mx-auto mb-6 flex w-full max-w-sm gap-1 rounded-2xl bg-secondary p-1">
					<button
						className={cn(
							"flex-1 rounded-xl px-4 py-2.5 font-medium text-sm transition-all",
							!isSignUpMode
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground",
						)}
						onClick={() => setIsSignUpMode(false)}
						type="button"
					>
						Sign in
					</button>
					<button
						className={cn(
							"flex-1 rounded-xl px-4 py-2.5 font-medium text-sm transition-all",
							isSignUpMode
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground",
						)}
						onClick={() => setIsSignUpMode(true)}
						type="button"
					>
						Sign up
					</button>
				</div>

				{/* Auth Form */}
				<form
					className="mx-auto flex w-full max-w-sm flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						authMutation.mutate();
					}}
				>
					{isSignUpMode && (
						<div>
							<label
								className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
								htmlFor="auth-name"
							>
								Name
							</label>
							<Input
								autoComplete="name"
								className="h-13 rounded-2xl bg-secondary px-4 text-base"
								id="auth-name"
								onChange={(event) => setAuthName(event.target.value)}
								placeholder="Your name"
								required
								value={authName}
							/>
						</div>
					)}

					<div>
						<label
							className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="auth-email"
						>
							Email
						</label>
						<Input
							autoComplete="email"
							className="h-13 rounded-2xl bg-secondary px-4 text-base"
							id="auth-email"
							onChange={(event) => setAuthEmail(event.target.value)}
							placeholder="name@company.com"
							required
							type="email"
							value={authEmail}
						/>
					</div>

					<div>
						<label
							className="mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="auth-password"
						>
							Password
						</label>
						<div className="relative">
							<Input
								autoComplete={isSignUpMode ? "new-password" : "current-password"}
								className="h-13 rounded-2xl bg-secondary px-4 pr-12 text-base"
								id="auth-password"
								onChange={(event) => setAuthPassword(event.target.value)}
								placeholder="Enter password"
								required
								type={showPassword ? "text" : "password"}
								value={authPassword}
							/>
							<button
								className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground"
								onClick={() => setShowPassword(!showPassword)}
								type="button"
							>
								<HugeiconsIcon
									icon={showPassword ? ViewOffIcon : EyeIcon}
									size={20}
									strokeWidth={2}
								/>
							</button>
						</div>
					</div>

					<Button
						className="mt-2 h-13 rounded-2xl font-semibold text-base"
						disabled={authMutation.isPending}
						size="lg"
						type="submit"
					>
						{authMutation.isPending
							? "Please wait..."
							: isSignUpMode
								? "Create account"
								: "Sign in"}
					</Button>
				</form>
			</div>
		</main>
	);
}
