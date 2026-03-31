// @ts-check
// If you want to use the fully resolved Next.js
// configuration to resolve Serwist configuration,
// use `serwist.withNextConfig` instead.
import { serwist } from "@serwist/next/config";

export default serwist.withNextConfig((nextConfig) => ({
	swSrc: "src/app/sw.ts",
	swDest: "public/sw.js",
	globIgnores: [
		`${nextConfig.distDir}/server/pages/**/*.json`,
		`${nextConfig.distDir}/server/app/ignored.html`,
	],
}));
