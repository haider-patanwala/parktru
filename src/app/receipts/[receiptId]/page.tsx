import { getSharedReceiptPreview } from "@/features/operator-operations/models/operator-operations.repository";
import { PublicReceiptPage } from "@/features/operator-operations/views/public-receipt-page";

export default async function ReceiptPage({
	params,
	searchParams,
}: {
	params: Promise<{ receiptId: string }>;
	searchParams: Promise<{ token?: string }>;
}) {
	const { receiptId } = await params;
	const { token } = await searchParams;
	const receipt = token
		? await getSharedReceiptPreview({
				receiptId,
				shareToken: token,
			})
		: null;

	return <PublicReceiptPage receipt={receipt} />;
}
