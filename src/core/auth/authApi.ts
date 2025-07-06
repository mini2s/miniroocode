// import * as vscode from 'vscode';
import * as querystring from "querystring"

import { AuthConfig } from "./authConfig"
import type { ProviderSettings } from "@roo-code/types"
import type { ClineProvider } from "../webview/ClineProvider"
import { AuthTokens, LoginState } from "./types"
import { Package } from "../../shared/package"
import { createHeaders, getParams } from "../../utils/zgsmUtils"
import { joinUrl } from "../../utils/joinUrl"

export interface LoginResponse {
	success: boolean
	data?: LoginState
	error?: string
	status?: number
}

export interface LoginTokenResponse {
	success: boolean
	data?: AuthTokens
	error?: string
	status?: number
}
export class AuthApi {
	private config: AuthConfig
	private clineProvider?: ClineProvider
	loginUrl = "/oidc-auth/api/v1/plugin/login"
	tokenUrl = "/oidc-auth/api/v1/plugin/login/token"
	statusUrl = "/oidc-auth/api/v1/plugin/login/status"
	logoutUrl = `/oidc-auth/api/v1/plugin/logout`

	constructor(clineProvider?: ClineProvider) {
		this.config = AuthConfig.getInstance()
		this.clineProvider = clineProvider
	}

	/**
	 * 设置ClineProvider实例
	 */
	setClineProvider(clineProvider: ClineProvider): void {
		this.clineProvider = clineProvider
	}

	/**
	 * 获取API配置
	 */
	private async getApiConfiguration(): Promise<ProviderSettings> {
		if (this.clineProvider) {
			try {
				const state = await this.clineProvider.getState()
				return state.apiConfiguration
			} catch (error) {
				console.error("获取API配置失败:", error)
			}
		}

		// 返回默认配置
		return {
			apiProvider: "zgsm",
			apiKey: "",
			zgsmBaseUrl: this.config.getDefaultLoginBaseUrl(),
		}
	}

	/**
	 * 获取API基础URL
	 */
	private async getApiBaseUrl(): Promise<string> {
		const apiConfig = await this.getApiConfiguration()

		// 优先使用apiConfiguration中的baseUrl
		if (apiConfig.zgsmBaseUrl) {
			return `${apiConfig.zgsmBaseUrl}/api`
		}

		// 使用默认API URL
		return this.config.getDefaultApiBaseUrl()
	}

	/**
	 * 用户退出登录
	 */
	async logoutUser(state?: string, access_token?: string): Promise<void> {
		try {
			const baseUrl = await this.getApiBaseUrl()
			const params = getParams(state || "", ["machine_code"])
			const url = `${baseUrl}?${params.map((p) => p.join("=")).join("&")}`

			await fetch(url, {
				method: "GET",
				headers: { Authorization: `Bearer ${access_token}` },
			})
		} catch (error) {
			console.error("用户退出登录 api 失败:", error)
		}
	}

	/**
	 * 获取用户登录状态
	 */
	async getUserLoginState(state: string, access_token: string): Promise<LoginResponse> {
		try {
			const baseUrl = await this.getApiBaseUrl()
			const params = getParams(state, [access_token ? "machine_code" : ""])
			const url = `${joinUrl(baseUrl, [this.statusUrl])}?${params.map((p) => p.join("=")).join("&")}`
			const response = await fetch(url, {
				method: "GET",
				headers: access_token ? { Authorization: `Bearer ${access_token}` } : {},
			})

			if (!response.ok) {
				const error = new Error(`HTTP error! status: ${response.status} \n ${await response.text()}`)
				Object.assign(error, { status: response.status })
				throw error
			}

			const data = await response.json()
			return data as LoginResponse
		} catch (error) {
			console.error("[getUserLoginState] 获取登录状态失败:", error)
			throw error
		}
	}

	/**
	 * 刷新用户token
	 */
	async getRefreshUserToken(refreshToken: string, machineId: string, state: string): Promise<LoginTokenResponse> {
		try {
			const baseUrl = await this.getApiBaseUrl()
			const params = getParams(state, [refreshToken ? "machine_code" : ""])

			const url = `${joinUrl(baseUrl, [this.tokenUrl])}?${params.map((p) => p.join("=")).join("&")}`
			const response = await fetch(url, {
				method: "GET",
				headers: refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {},
			})

			if (!response.ok) {
				const error = new Error(`HTTP error! status: ${response.status} \n ${await response.text()}`)
				Object.assign(error, { status: response.status })
				throw error
			}

			const data = await response.json()

			return data as LoginTokenResponse
		} catch (error) {
			console.error("[getRefreshUserToken] token获取失败:", error)
			throw error
		}
	}
}
