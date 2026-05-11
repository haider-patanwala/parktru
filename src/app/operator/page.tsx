import { Suspense } from "react";
import { OperatorOperationsPage } from "@/features/operator-operations/views/operator-operations-page";

export default function OperatorPage() {
	return (
		<Suspense fallback={null}>
			<OperatorOperationsPage />
		</Suspense>
	);
}
