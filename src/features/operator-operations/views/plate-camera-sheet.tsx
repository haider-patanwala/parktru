"use client";

import { toast } from "@heroui/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	type PlateOcrProgress,
	recognizePlateFromImage,
	releasePlateOcrWorker,
} from "@/features/operator-operations/lib/plate-camera-ocr";

interface PlateCameraSheetProps {
	onConfirm: (plateNumber: string) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type CaptureState = "preview" | "recognizing" | "review";

const GUIDE_HORIZONTAL_INSET = 0.1;
const GUIDE_VERTICAL_INSET = 0.22;

function buildPlateCropCanvas(
	video: HTMLVideoElement,
	containerElement: HTMLElement,
	guideElement: HTMLElement,
) {
	const containerRect = containerElement.getBoundingClientRect();
	const guideRect = guideElement.getBoundingClientRect();

	if (
		!containerRect.width ||
		!containerRect.height ||
		!video.videoWidth ||
		!video.videoHeight
	) {
		return null;
	}

	const coverScale = Math.max(
		containerRect.width / video.videoWidth,
		containerRect.height / video.videoHeight,
	);
	const renderedVideoWidth = video.videoWidth * coverScale;
	const renderedVideoHeight = video.videoHeight * coverScale;
	const renderedOffsetLeft = (containerRect.width - renderedVideoWidth) / 2;
	const renderedOffsetTop = (containerRect.height - renderedVideoHeight) / 2;

	const visibleGuideLeft = guideRect.left - containerRect.left;
	const visibleGuideTop = guideRect.top - containerRect.top;
	const insetGuideLeft =
		visibleGuideLeft + guideRect.width * GUIDE_HORIZONTAL_INSET;
	const insetGuideTop =
		visibleGuideTop + guideRect.height * GUIDE_VERTICAL_INSET;
	const insetGuideWidth = guideRect.width * (1 - GUIDE_HORIZONTAL_INSET * 2);
	const insetGuideHeight = guideRect.height * (1 - GUIDE_VERTICAL_INSET * 2);
	const sourceLeft = Math.max(
		0,
		Math.round((insetGuideLeft - renderedOffsetLeft) / coverScale),
	);
	const sourceTop = Math.max(
		0,
		Math.round((insetGuideTop - renderedOffsetTop) / coverScale),
	);
	const sourceWidth = Math.min(
		video.videoWidth - sourceLeft,
		Math.round(insetGuideWidth / coverScale),
	);
	const sourceHeight = Math.min(
		video.videoHeight - sourceTop,
		Math.round(insetGuideHeight / coverScale),
	);

	if (!sourceWidth || !sourceHeight) {
		return null;
	}

	const cropCanvas = document.createElement("canvas");
	cropCanvas.width = Math.min(sourceWidth, 1600);
	cropCanvas.height = Math.round(
		(cropCanvas.width / sourceWidth) * sourceHeight,
	);

	const cropContext = cropCanvas.getContext("2d");
	if (!cropContext) {
		return null;
	}

	cropContext.drawImage(
		video,
		sourceLeft,
		sourceTop,
		sourceWidth,
		sourceHeight,
		0,
		0,
		cropCanvas.width,
		cropCanvas.height,
	);

	return cropCanvas;
}

function buildProcessedPlateCanvas(sourceCanvas: HTMLCanvasElement) {
	const processedCanvas = document.createElement("canvas");
	processedCanvas.width = sourceCanvas.width;
	processedCanvas.height = sourceCanvas.height;

	const context = processedCanvas.getContext("2d");
	if (!context) {
		return null;
	}

	context.drawImage(sourceCanvas, 0, 0);

	const imageData = context.getImageData(
		0,
		0,
		processedCanvas.width,
		processedCanvas.height,
	);

	for (let index = 0; index < imageData.data.length; index += 4) {
		const red = imageData.data[index] ?? 0;
		const green = imageData.data[index + 1] ?? 0;
		const blue = imageData.data[index + 2] ?? 0;
		const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
		const contrastValue = luminance > 145 ? 255 : 0;

		imageData.data[index] = contrastValue;
		imageData.data[index + 1] = contrastValue;
		imageData.data[index + 2] = contrastValue;
	}

	context.putImageData(imageData, 0, 0);

	return processedCanvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
	return new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, "image/jpeg", 0.92);
	});
}

export function PlateCameraSheet({
	onConfirm,
	open,
	onOpenChange,
}: PlateCameraSheetProps) {
	const previewContainerRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const guideRef = useRef<HTMLDivElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const capturedImageUrlRef = useRef<string | null>(null);
	const [captureState, setCaptureState] = useState<CaptureState>("preview");
	const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
	const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
	const [recognizedPlateNumber, setRecognizedPlateNumber] = useState("");
	const [recognizedRawText, setRecognizedRawText] = useState("");
	const [ocrProgress, setOcrProgress] = useState<PlateOcrProgress | null>(null);
	const [isCameraReady, setIsCameraReady] = useState(false);

	const stopCameraStream = useCallback(() => {
		streamRef.current?.getTracks().forEach((track) => {
			track.stop();
		});
		streamRef.current = null;
		setIsCameraReady(false);
	}, []);

	const resetCaptureState = useCallback(() => {
		if (capturedImageUrl) {
			URL.revokeObjectURL(capturedImageUrl);
		}
		setCapturedImageUrl(null);
		setCapturedBlob(null);
		setRecognizedPlateNumber("");
		setRecognizedRawText("");
		setOcrProgress(null);
		setCaptureState("preview");
	}, [capturedImageUrl]);

	useEffect(() => {
		capturedImageUrlRef.current = capturedImageUrl;
	}, [capturedImageUrl]);

	useEffect(() => {
		if (!open) {
			stopCameraStream();
			void releasePlateOcrWorker();
			resetCaptureState();
			return;
		}

		if (
			typeof navigator === "undefined" ||
			!navigator.mediaDevices?.getUserMedia
		) {
			toast.danger("Camera access is not supported on this device.", {
				timeout: 2500,
			});
			onOpenChange(false);
			return;
		}

		let isCancelled = false;

		const startCamera = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						facingMode: { ideal: "environment" },
						height: { ideal: 720 },
						width: { ideal: 1280 },
					},
				});

				if (isCancelled) {
					stream.getTracks().forEach((track) => {
						track.stop();
					});
					return;
				}

				streamRef.current = stream;
				const video = videoRef.current;
				if (!video) {
					return;
				}

				video.srcObject = stream;
				await video.play();
				setIsCameraReady(true);
			} catch (error) {
				toast.danger(
					error instanceof Error
						? error.message
						: "Camera permission was denied.",
					{ timeout: 2500 },
				);
				onOpenChange(false);
			}
		};

		void startCamera();

		return () => {
			isCancelled = true;
			stopCameraStream();
		};
	}, [onOpenChange, open, resetCaptureState, stopCameraStream]);

	useEffect(() => {
		return () => {
			stopCameraStream();
			void releasePlateOcrWorker();
			if (capturedImageUrlRef.current) {
				URL.revokeObjectURL(capturedImageUrlRef.current);
			}
		};
	}, [stopCameraStream]);

	const captureFrame = async () => {
		const video = videoRef.current;
		const previewContainer = previewContainerRef.current;
		const guide = guideRef.current;
		if (!video || !video.videoWidth || !video.videoHeight) {
			toast.danger("Camera is not ready yet. Try again in a moment.", {
				timeout: 2500,
			});
			return;
		}

		if (!previewContainer || !guide) {
			toast.danger("Could not align the capture frame.", { timeout: 2500 });
			return;
		}

		const cropCanvas = buildPlateCropCanvas(video, previewContainer, guide);
		if (!cropCanvas) {
			toast.danger("Could not prepare the camera capture.", { timeout: 2500 });
			return;
		}

		const processedCanvas = buildProcessedPlateCanvas(cropCanvas) ?? cropCanvas;
		const blob = await canvasToBlob(processedCanvas);

		if (!blob) {
			toast.danger("Could not capture the current frame.", { timeout: 2500 });
			return;
		}

		if (capturedImageUrl) {
			URL.revokeObjectURL(capturedImageUrl);
		}

		const nextUrl = URL.createObjectURL(blob);
		setCapturedBlob(blob);
		setCapturedImageUrl(nextUrl);
		setRecognizedPlateNumber("");
		setRecognizedRawText("");
		setCaptureState("recognizing");
		setOcrProgress({
			progress: 0,
			status: "Preparing OCR",
		});

		try {
			const result = await recognizePlateFromImage(blob, setOcrProgress);
			setRecognizedPlateNumber(result.normalizedPlateNumber);
			setRecognizedRawText(result.rawText);
			setCaptureState("review");
		} catch (error) {
			setCaptureState("review");
			toast.danger(
				error instanceof Error
					? error.message
					: "OCR could not read the plate.",
				{ timeout: 2500 },
			);
		}
	};

	const retryCapture = () => {
		resetCaptureState();
	};

	const confirmPlate = () => {
		if (!recognizedPlateNumber) {
			toast.danger("No plate number was detected. Try again.", {
				timeout: 2500,
			});
			return;
		}

		onConfirm(recognizedPlateNumber);
		onOpenChange(false);
	};

	return (
		<Drawer direction="bottom" onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="max-h-[88dvh]">
				<DrawerHeader className="px-5 pt-2 pb-3 text-left">
					<DrawerTitle>Scan vehicle plate</DrawerTitle>
					<DrawerDescription>
						Capture one frame, review the result, then fill the Gate field.
					</DrawerDescription>
				</DrawerHeader>

				<div className="px-5 pb-2">
					<div className="overflow-hidden rounded-[1.75rem] bg-neutral-950">
						{captureState === "preview" ? (
							<div className="relative aspect-[4/3]" ref={previewContainerRef}>
								<video
									autoPlay
									className="h-full w-full object-cover"
									muted
									playsInline
									ref={videoRef}
								/>
								<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
									<div
										className="h-28 w-full rounded-[1.5rem] border border-white/75 bg-black/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
										ref={guideRef}
									/>
								</div>
								<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 via-black/15 to-transparent px-4 py-4 text-white">
									<p className="font-medium text-sm">
										Center the plate inside the frame
									</p>
									<p className="mt-1 text-white/80 text-xs">
										Use the rear camera and keep the plate flat and readable.
									</p>
								</div>
							</div>
						) : (
							<div className="relative aspect-[4/3] bg-secondary">
								{capturedImageUrl ? (
									<Image
										alt="Captured vehicle plate"
										className="h-full w-full object-cover"
										fill
										sizes="100vw"
										src={capturedImageUrl}
										unoptimized
									/>
								) : (
									<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
										No frame captured yet.
									</div>
								)}
							</div>
						)}
					</div>

					{captureState !== "preview" && (
						<div className="mt-4 rounded-[1.5rem] border border-border bg-card p-4">
							<p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-[0.18em]">
								{captureState === "recognizing" ? "Reading plate" : "Detected"}
							</p>
							<p className="mt-2 font-mono text-2xl tracking-[0.25em]">
								{recognizedPlateNumber || "No plate found"}
							</p>
							{ocrProgress && captureState === "recognizing" && (
								<p className="mt-2 text-muted-foreground text-sm">
									{ocrProgress.status} {Math.round(ocrProgress.progress * 100)}%
								</p>
							)}
							{captureState === "review" && (
								<p className="mt-2 text-muted-foreground text-sm">
									{recognizedRawText
										? `Raw OCR: ${recognizedRawText}`
										: "Try again if the result does not look right."}
								</p>
							)}
						</div>
					)}
				</div>

				<DrawerFooter className="px-5 pt-3 pb-5">
					{captureState === "preview" ? (
						<>
							<Button
								className="h-13 rounded-2xl font-semibold text-base"
								disabled={!isCameraReady}
								onClick={captureFrame}
								type="button"
							>
								{isCameraReady ? "Capture frame" : "Starting camera..."}
							</Button>
							<Button
								className="rounded-2xl"
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</>
					) : captureState === "recognizing" ? (
						<Button
							className="rounded-2xl"
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Close
						</Button>
					) : (
						<>
							<Button
								className="h-13 rounded-2xl font-semibold text-base"
								disabled={!capturedBlob || !recognizedPlateNumber}
								onClick={confirmPlate}
								type="button"
							>
								Use this plate
							</Button>
							<Button
								className="rounded-2xl"
								onClick={retryCapture}
								type="button"
								variant="outline"
							>
								Retry
							</Button>
							<Button
								className="rounded-2xl"
								onClick={() => onOpenChange(false)}
								type="button"
								variant="ghost"
							>
								Cancel
							</Button>
						</>
					)}
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
