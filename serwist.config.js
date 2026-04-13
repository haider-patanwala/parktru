// @ts-check
// If you want to use the fully resolved Next.js
// configuration to resolve Serwist configuration,
// use `serwist.withNextConfig` instead.
import { serwist } from "@serwist/next/config";

export default serwist.withNextConfig((nextConfig) => ({
	swSrc: "src/app/sw.ts",
	swDest: "public/sw.js",
	// Default 2 MiB skips large static assets (e.g. public/tesseract/lang-data/*.traineddata.gz).
	maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
	globIgnores: [
		`${nextConfig.distDir}/server/pages/**/*.json`,
		`${nextConfig.distDir}/server/app/ignored.html`,
	],
}));
