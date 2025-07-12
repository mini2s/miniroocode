import os from "os"

import * as vscode from "vscode"
import { Package } from "../shared/package"
import { getClientId } from "./getClientId"

export function getParams(state: string, ignore: string[] = []) {
	return [
		["machine_code", getClientId()],
		["state", state],
		["provider", "casdoor"],
		["plugin_version", "1.5.3"],
		// ["plugin_version", Package.version],
		["vscode_version", vscode.version],
		["uri_scheme", vscode.env.uriScheme],
	].filter(([key]) => !ignore.includes(key))
}

export async function retryWrapper<T>(
	rid: string,
	fn: () => Promise<T>,
	interval = (attempt: number) => 1000 * Math.pow(2, attempt),
	maxAttempt = 3,
): Promise<T> {
	let lastError: Error | undefined
	const _maxAttempt = Math.max(1, maxAttempt)
	let attempt = 0
	for (; attempt < _maxAttempt; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			console.warn(`[${rid}] Attempt ${attempt + 1} failed:`, lastError.message)
			await new Promise((resolve) => setTimeout(resolve, interval(attempt)))
		}
	}
	throw lastError || new Error(`Operation failed after ${attempt} attempts`)
}

export function parseJwt(token: string) {
	const parts = token.split(".")
	if (parts.length !== 3) {
		throw new Error("Invalid JWT")
	}
	const payload = parts[1]
	const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/")) // base64url → base64 → decode
	return JSON.parse(decoded)
}

export function getLocalIP(): string {
	try {
		const interfaces = os.networkInterfaces()
		for (const key in interfaces) {
			for (const alias of interfaces[key] ?? []) {
				if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
					return alias.address
				}
			}
		}
	} catch (error) {
		console.log(`[zgsm getLocalIP]: ${error.message}`)
	}

	return "127.0.0.1"
}

export function createHeaders(dict: Record<string, any> = {}): Record<string, any> {
	// Get extended information
	const extension = vscode.extensions.getExtension("zgsm-ai.zgsm")
	const extVersion = extension?.packageJSON.version || "1.4.7"
	const ideVersion = vscode.version || ""
	const hostIp = getLocalIP()

	const headers = {
		ide: "vscode",
		"ide-version": extVersion,
		"ide-real-version": ideVersion,
		"host-ip": hostIp,
		...dict,
	}
	return headers
}
