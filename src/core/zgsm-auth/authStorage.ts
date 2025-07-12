import * as vscode from "vscode"
import type { ZgsmAuthTokens, ZgsmLoginState } from "./types"
import type { ClineProvider } from "../webview/ClineProvider"
import { parseJwt } from "../../utils/zgsmUtils"
import { sendTokens } from "./ipc/client"
import { initZgsmCodeBase } from "../codebase"
import { ZgsmAuthConfig } from "./authConfig"
import { getClientId } from "../../utils/getClientId"
// import { safeJsonParse } from "../../shared/safeJsonParse"

export class ZgsmAuthStorage {
	private clineProvider?: ClineProvider
	private static instance?: ZgsmAuthStorage

	constructor(clineProvider?: ClineProvider) {
		this.clineProvider = clineProvider
	}

	public static initialize(clineProvider?: ClineProvider): void {
		if (!ZgsmAuthStorage.instance) {
			ZgsmAuthStorage.instance = new ZgsmAuthStorage(clineProvider)
		}
	}
	public static getInstance(): ZgsmAuthStorage {
		if (!ZgsmAuthStorage.instance) {
			ZgsmAuthStorage.instance = new ZgsmAuthStorage()
		}
		return ZgsmAuthStorage.instance
	}

	/**
	 * 设置ClineProvider实例
	 */
	setClineProvider(clineProvider: ClineProvider): ZgsmAuthStorage {
		this.clineProvider = clineProvider
		return this
	}

	/**
	 * 保存认证token
	 */
	async saveTokens(tokens: ZgsmAuthTokens): Promise<void> {
		if (!this.clineProvider) return
		const state = await this.clineProvider.getState()
		if (!state.currentApiConfigName) {
			return
		}
		if (
			tokens.access_token === state.apiConfiguration.zgsmAccessToken ||
			tokens.refresh_token === state.apiConfiguration.zgsmRefreshToken
		) {
			this.clineProvider?.log(`[ZgsmLoginManager:${state}] saveTokens: tokens are already saved`)
			return
		}
		const zgsmApiKeyUpdatedAt = new Date().toLocaleString()
		const zgsmApiKeyExpiredAt = new Date(parseJwt(tokens.access_token).exp * 1000).toLocaleString()
		const config = {
			...state.apiConfiguration,
			zgsmRefreshToken: tokens.refresh_token,
			zgsmAccessToken: tokens.access_token,
			zgsmState: tokens.state,
			zgsmApiKeyUpdatedAt,
			zgsmApiKeyExpiredAt,
		}
		await this.clineProvider?.providerSettingsManager.saveMergeConfig(config, (name, { apiProvider }) => {
			return apiProvider === "zgsm" && name !== state.currentApiConfigName
		})
		// well
		this.clineProvider.setValue("zgsmRefreshToken", tokens.refresh_token)
		this.clineProvider.setValue("zgsmAccessToken", tokens.access_token)
		this.clineProvider.setValue("zgsmState", tokens.state)
		this.clineProvider.setValue("zgsmApiKeyUpdatedAt", zgsmApiKeyUpdatedAt)
		this.clineProvider.setValue("zgsmApiKeyExpiredAt", zgsmApiKeyExpiredAt)
		// well well
		await this.clineProvider.upsertProviderProfile(state.currentApiConfigName, config, false)

		sendTokens(tokens)

		initZgsmCodeBase(
			state.apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl(),
			tokens.access_token,
		)
	}

	/**
	 * 获取保存的认证token
	 */
	async getTokens(): Promise<ZgsmAuthTokens | null> {
		if (!this.clineProvider) return null
		const state = await this.clineProvider.getState()
		return {
			access_token: state.apiConfiguration.zgsmAccessToken,
			refresh_token: state.apiConfiguration.zgsmRefreshToken,
			state: state.apiConfiguration.zgsmState,
		} as ZgsmAuthTokens
	}

	/**
	 * 保存登录状态
	 */
	async saveLoginState(loginState: ZgsmLoginState): Promise<void> {
		if (!this.clineProvider) return
		const state = await this.clineProvider.getState()
		if (!state.currentApiConfigName) {
			return
		}
		const config = { ...state.apiConfiguration, zgsmState: loginState.state }
		// well
		this.clineProvider.setValue("zgsmState", loginState.state)

		await this.clineProvider.upsertProviderProfile(state.currentApiConfigName, config, false)
	}

	/**
	 * 获取保存的登录状态
	 */
	async getLoginState(): Promise<ZgsmLoginState | null> {
		if (!this.clineProvider) return null
		const state = await this.clineProvider.getState()
		return state.apiConfiguration.zgsmState
			? { state: state.apiConfiguration.zgsmState, machineId: getClientId() }
			: null
	}

	/**
	 * 清除所有认证信息
	 */
	async clearAllLoginState(): Promise<void> {
		if (!this.clineProvider) return
		const state = await this.clineProvider.getState()
		if (!state.currentApiConfigName) {
			return
		}
		const { zgsmAccessToken, zgsmRefreshToken, zgsmState, ...config } = state.apiConfiguration

		await this.clineProvider.setValue("zgsmAccessToken", undefined)
		await this.clineProvider.setValue("zgsmRefreshToken", undefined)
		await this.clineProvider.setValue("zgsmState", undefined)
		await this.clineProvider.upsertProviderProfile(state.currentApiConfigName, config, false)
	}

	/**
	 * 检查是否有有效的登录信息
	 */
	async hasValidLogin(): Promise<boolean> {
		const tokens = await this.getTokens()
		return !!(tokens && tokens.access_token && tokens.refresh_token)
	}
}
