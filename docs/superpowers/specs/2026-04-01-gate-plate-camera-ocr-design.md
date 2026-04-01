# Gate Plate Camera OCR Design

Date: 2026-04-01
Status: Draft approved for planning
Scope: On-device single-frame camera capture for the Gate plate field

## Summary

This design adds a mobile-first camera assist flow to the Gate vehicle plate input so operators can capture one frame, extract the plate number on-device, review the result, and then populate the existing field manually.

The goal is not full ANPR. The first slice is a browser-native, on-device OCR assist that improves gate speed while preserving operator control.

The implementation includes:

- a camera action beside the existing plate input in the Gate view
- a mobile-first capture sheet using the device rear camera
- single-frame image capture
- on-device OCR using `tesseract.js`
- Arabic and Latin digit normalization before filling the plate field
- explicit confirm and retry actions before updating the input

The implementation excludes:

- continuous live-video scanning
- cloud OCR or cloud ANPR
- server-side image upload for recognition
- custom trainable plate detection models
- automatic submit after scan

## Product Decisions Captured

- The scan flow must run on-device in the browser.
- A single captured frame is acceptable; continuous live scanning is not required.
- The operator must confirm the recognized result before it fills the plate field.
- Arabic numbers must be supported.
- The camera flow is an assistive input path, not a replacement for manual entry.

## Goals

- Reduce manual typing effort at the gate on mobile devices.
- Keep the feature fast enough for practical use on modern phones.
- Reuse the existing plate lookup and normalization flow after OCR completes.
- Keep the failure mode simple: retry capture or fall back to manual entry.

## Non-Goals

- Production-grade ANPR accuracy for every plate style
- Detection of plate bounding boxes with a dedicated model
- Background scanning while video is running
- OCR in desktop-only workflows

## Technical Decision

Use `tesseract.js` in the browser with intentionally limited scope:

- request the environment-facing camera with `getUserMedia`
- capture a single still frame from the video element
- preprocess only lightly in-browser if needed
- run OCR locally with Arabic and English language data
- normalize Arabic numerals into ASCII digits before passing the value into the existing plate field

### Why This Approach

- It satisfies the on-device requirement.
- It has a documented browser path and TypeScript support.
- It supports Arabic language data without inventing a custom OCR stack.
- It keeps integration complexity low enough for the current repo.

### Why Not Cloud ANPR

Cloud services violate the on-device requirement and add network latency and privacy concerns at the gate.

### Why Not a Custom Browser ANPR Stack

A dedicated detection-plus-recognition model stack would likely improve accuracy, but it adds significant model-management, asset-size, and tuning cost. That is too heavy for the first implementation slice.

## Architecture

This feature belongs inside `src/features/operator-operations/` because it is only used by the Gate workflow.

Suggested file placement:

```text
src/
  features/
    operator-operations/
      lib/
        plate-camera-ocr.ts
        plate-camera-normalization.ts
      views/
        gate-tab.tsx
        plate-camera-sheet.tsx
```

Boundaries:

- `gate-tab.tsx` owns the plate field and opening or closing the camera sheet
- `plate-camera-sheet.tsx` owns camera preview, capture, OCR progress, and confirm or retry UI
- `plate-camera-ocr.ts` owns `tesseract.js` worker lifecycle and recognition calls
- `plate-camera-normalization.ts` owns Arabic-digit conversion and plate text cleanup

No server routes are required for this slice.

## UI Design

### Gate Input

In the existing Gate search row, add a secondary camera button beside the `Find` button.

Behavior:

- enabled when camera APIs are available
- opens the capture sheet
- does not replace the existing text input and `Find` action

### Capture Sheet

The camera UI should use a bottom sheet on mobile, consistent with the repo’s low-cognitive-load direction.

The sheet contains:

- title and short instruction
- rear-camera preview
- visible framing guide to center the plate
- capture button
- cancel button

After capture, the preview area switches to a captured image review state with:

- OCR progress indicator while recognition runs
- recognized text preview
- confirm button
- retry button
- cancel button

### Confirmation Rule

The recognized value must never auto-submit. Confirming should only populate the existing `plateNumber` state in `gate-tab.tsx`.

## OCR Flow

1. Operator opens the camera sheet.
2. App requests the environment-facing camera.
3. Operator captures a frame.
4. The frame is converted to an image source from a canvas.
5. OCR runs locally using Arabic and English language assets.
6. The raw OCR output is normalized:
   - convert Arabic-Indic and Eastern Arabic-Indic digits to ASCII digits
   - uppercase Latin letters
   - remove spaces and unsupported punctuation where appropriate
   - pass through the existing `normalizePlateNumber` helper for final cleanup
7. The operator reviews the recognized text.
8. On confirm, the Gate plate field is updated.

## Performance Constraints

Because this runs on phones, the implementation should optimize for short sessions:

- lazy-load `tesseract.js` only when the camera sheet is first opened
- create one worker per sheet session, not per recognition attempt
- terminate the worker when the sheet closes
- use a single captured frame rather than continuous OCR on video
- prefer moderate capture resolution over full camera resolution

## Error Handling

The flow must handle these cases explicitly:

- camera permission denied
- no camera device available
- OCR worker load failure
- OCR completes but returns empty or unusable text
- operator closes the sheet mid-flow

UI behavior:

- show clear toast or inline status for hard failures
- keep retry available when capture succeeded but OCR was weak
- keep manual typing as the fallback path at all times

## Arabic Numeral Support

This slice must normalize common Arabic numeral forms:

- Arabic-Indic digits: `٠١٢٣٤٥٦٧٨٩`
- Eastern Arabic-Indic digits: `۰۱۲۳۴۵۶۷۸۹`

They should be converted to ASCII `0-9` before existing plate normalization runs.

This requirement is limited to number handling in the first slice. Full Arabic-script plate-text support beyond numeric conversion is not promised here.

## Testing

Implementation verification should cover:

- Gate field still works manually without using the camera
- camera sheet opens and closes correctly on mobile layout
- confirm populates the existing plate field
- retry keeps the field unchanged
- Arabic numerals normalize correctly into ASCII digits
- OCR failure leaves the operator able to continue manually

Validation commands:

- `bun run typecheck`
- targeted UI and flow verification in the Gate view when camera access is available

## Risks

- OCR accuracy will vary by plate style, lighting, blur, and camera quality.
- Generic OCR may read surrounding text or miss characters on busy backgrounds.
- Arabic letters on plates may require a later dedicated model if the numeric-first normalization is not enough in real use.

## Follow-Up Triggers

Escalate to a dedicated browser ANPR model only if real operator usage shows that:

- OCR accuracy is too low for practical gate use
- Arabic-script plates need richer character recognition than this slice provides
- operators need continuous scan instead of capture-and-confirm

## Sources

- Tesseract.js README: https://github.com/naptha/tesseract.js/blob/master/README.md
- Tesseract language support: https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html
- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- PaddleOCR multilingual reference used for alternative evaluation: https://www.paddleocr.ai/latest/en/version2.x/ppocr/blog/multi_languages.html
