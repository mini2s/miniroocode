import * as vscode from "vscode"
import { AuthStorage } from "./authStorage"
import { AuthApi } from "./authApi"
import { AuthConfig } from "./authConfig"
import type { ProviderSettings, LoginState, AuthTokens } from "@roo-code/types"
import type { ClineProvider } from "../webview/ClineProvider"
import { getParams, retryWrapper } from "../../utils/zgsmUtils"
import { joinUrl } from "../../utils/joinUrl"
import { AuthStatus } from "./types"

export class ZgsmAuthService {
	private static instance: ZgsmAuthService

	private storage: AuthStorage
	private api: AuthApi
	private loginStateTmp: LoginState | undefined
	private config: AuthConfig
	private waitLoginPollingInterval?: NodeJS.Timeout
	private tokenRefreshInterval?: NodeJS.Timeout
	private clineProvider?: ClineProvider

	protected constructor(clineProvider?: ClineProvider) {
		this.storage = AuthStorage.getInstance()
		if (clineProvider) {
			this.storage.setClineProvider(clineProvider)
		}
		this.api = new AuthApi(clineProvider)
		this.config = AuthConfig.getInstance() // 使用单例
		this.clineProvider = clineProvider
	}

	public static initialize(clineProvider?: ClineProvider): void {
		if (!ZgsmAuthService.instance) {
			ZgsmAuthService.instance = new ZgsmAuthService(clineProvider)
		}
	}

	public static getInstance(): ZgsmAuthService {
		if (!ZgsmAuthService.instance) {
			// 在实际应用中，initialize应该已经被调用。
			// 如果未初始化，这里创建一个没有 clineProvider 的实例作为后备。
			ZgsmAuthService.instance = new ZgsmAuthService()
		}
		return ZgsmAuthService.instance
	}

	/**
	 * Resets the singleton instance for testing purposes.
	 * @internal
	 */
	public static _resetForTesting(): void {
		ZgsmAuthService.instance = undefined!
	}

	/**
	 * 设置ClineProvider实例
	 */
	setClineProvider(clineProvider: ClineProvider): ZgsmAuthService {
		this.clineProvider = clineProvider
		this.api.setClineProvider(clineProvider)
		return this
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

	// 异步处理URI回调登录（即将废弃）
	async handleUriCallbackLogin(code: string, state: string) {
		// try {
		// 	const { tokens } = await retryWrapper("handleUriCallbackLogin", () => this.api.getAccessToken(code, state))
		// 	if (!tokens) {
		// 		throw new Error("获取token失败")
		// 	}
		// 	await this.storage.saveTokens({
		// 		access_token: tokens.access_token,
		// 		refresh_token: tokens.refresh_token,
		// 		state,
		// 	})
		// } catch (error) {
		// 	console.error("处理URI回调登录失败:", error)
		// }
	}
	/**
	 * 启动登录流程
	 */
	async startLogin(): Promise<LoginState> {
		this.stopWaitLoginPolling()

		try {
			// 生成新的登录状态参数
			this.loginStateTmp = this.generateLoginState()

			// 构建登录URL
			const loginUrl = await this.buildLoginUrl(this.loginStateTmp)

			// 在默认浏览器中打开登录页面
			await vscode.env.openExternal(vscode.Uri.parse(loginUrl))

			// 显示通知
			vscode.window.showInformationMessage("登录页面已在浏览器中打开，请完成登录")
			const result = await retryWrapper(
				"startLogin.getRefreshUserToken",
				() => this.api.getRefreshUserToken("", this.getMachineId(), this.loginStateTmp!.state),
				() => 3000,
				100,
			)
			// // 开始轮询登录状态
			this.startWaitLoginPolling(Object.assign(this.loginStateTmp, result.data))

			return this.loginStateTmp
		} catch (error) {
			vscode.window.showErrorMessage(`启动登录失败: ${error}`)
			throw error
		}
	}

	/**
	 * 开始轮询登录状态
	 */
	private async startWaitLoginPolling(loginState: LoginState & AuthTokens): Promise<void> {
		const maxAttempt = 60
		let attempt = 0
		const pollLoginState = async () => {
			try {
				const response = await retryWrapper(
					"pollLoginState",
					() => this.api.getUserLoginState(loginState.state, loginState.access_token),
					undefined,
					0,
				)

				if (
					response.success &&
					response.data?.state &&
					response.data.state === this.loginStateTmp?.state &&
					response.data?.status === AuthStatus.LOGGED_IN
				) {
					// 登录成功，保存token
					await this.storage.saveTokens(loginState)
					// 登录成功后 保存登录状态到本地
					await this.storage.saveLoginState(loginState)
					// 停止轮询
					this.stopWaitLoginPolling()

					// 开始token刷新定时器
					this.startTokenRefresh(loginState.refresh_token, loginState.machineId, loginState.state)

					vscode.window.showInformationMessage("登录成功！")

					// 触发登录成功事件
					this.onLoginSuccess(loginState)
					return
				}
			} catch (error) {
				console.error("轮询登录状态失败:", error)
			}

			if (++attempt > maxAttempt) {
				vscode.window.showInformationMessage("登录超时！")
			}

			// 设置轮询间隔（每5秒检查一次）
			this.waitLoginPollingInterval = setTimeout(pollLoginState, this.config.getWaitLoginPollingInterval())
		}

		// 立即执行一次
		await pollLoginState()
	}

	/**
	 * 停止轮询
	 */
	private stopWaitLoginPolling(): void {
		if (this.waitLoginPollingInterval) {
			clearInterval(this.waitLoginPollingInterval)
			this.waitLoginPollingInterval = undefined
		}
	}

	/**
	 * 开始token刷新定时器
	 */
	startTokenRefresh(refreshToken: string, machineId: string, state: string): void {
		// 清除之前的定时器
		if (this.tokenRefreshInterval) {
			clearInterval(this.tokenRefreshInterval)
		}

		// 定时刷新一次token
		this.tokenRefreshInterval = setInterval(
			async (refreshToken, machineId, state) => {
				try {
					await this.refreshToken(refreshToken, machineId, state)
				} catch (error) {
					console.error("自动刷新token失败:", error)
					vscode.window.showErrorMessage("Token刷新失败，请重新登录")
					// this.logout()
				}
			},
			this.config.getTokenRefreshInterval(refreshToken),
			refreshToken,
			machineId,
			state,
		)
	}

	/**
	 * 刷新token
	 */
	async refreshToken(refreshToken: string, machineId: string, state: string, auto = true): Promise<AuthTokens> {
		try {
			const response = await retryWrapper("refreshToken", () =>
				this.api.getRefreshUserToken(refreshToken, machineId, state),
			)

			if (
				response.success &&
				response.data &&
				response.data.access_token &&
				response.data.refresh_token &&
				this.loginStateTmp?.state === response.data.state
			) {
				// 更新保存的token
				await this.storage.saveTokens(response.data)

				// 更新刷新定时器
				if (auto) {
					this.startTokenRefresh(response.data.refresh_token, machineId, state)
				}

				return response.data
			} else {
				throw new Error(`[${state}]` + (response.error || "刷新token失败"))
			}
		} catch (error) {
			console.error(`[${state}] 刷新token失败`, error)
			throw error
		}
	}

	async getTokens() {
		return await this.storage.getTokens()
	}

	/**
	 * 插件启动时检查登录状态
	 */
	async checkLoginStatusOnStartup(): Promise<boolean> {
		try {
			const tokens = await this.storage.getTokens()

			const loginState = await this.storage.getLoginState()

			if (!tokens?.access_token || !tokens?.refresh_token) {
				return false
			}
			const machineId = this.getMachineId()
			// 尝试刷新token来验证登录状态
			// const newTokens = await this.refreshToken(tokens.refresh_token, vscode.env.machineId, tokens.state, false)
			const result = await retryWrapper(
				"checkLoginStatusOnStartup",
				() => this.api.getRefreshUserToken(tokens.refresh_token, machineId, tokens.state),
				() => 1000,
				2,
			)

			if (!result?.data?.refresh_token) {
				console.error("请求返回缺少 refresh_token")

				return false
			}

			return true
		} catch (error) {
			console.error("启动时检查登录状态失败:", error)
			// 清除无效的登录信息
			// await this.logout()
			return false
		}
	}

	/**
	 * 获取当前token
	 */
	async getCurrentAccessToken(): Promise<string | null> {
		const tokens = await this.storage.getTokens()
		return tokens?.access_token || null
	}

	/**
	 * 登出
	 */
	async logout(): Promise<void> {
		// 停止所有定时器
		this.stopWaitLoginPolling()
		if (this.tokenRefreshInterval) {
			clearInterval(this.tokenRefreshInterval)
			this.tokenRefreshInterval = undefined
		}

		// 触发登出事件
		await this.onLogout()
		// 清除存储的登录信息
		await this.storage.clearAllLoginState()

		vscode.window.showInformationMessage("已退出登录")
	}

	/**
	 * 生成登录状态参数
	 */
	private generateLoginState(): LoginState {
		return {
			state: this.generateRandomString(),
			machineId: this.getMachineId(),
		}
	}

	/**
	 * 构建登录URL
	 */
	private async buildLoginUrl(loginState: LoginState): Promise<string> {
		const apiConfig = await this.getApiConfiguration()
		const baseUrl = this.getLoginBaseUrl(apiConfig)
		const params = getParams(loginState.state, [])

		return `${joinUrl(baseUrl, [this.api.loginUrl])}?${params.map((p) => p.join("=")).join("&")}`

		// // 老的登陆逻辑
		// const scopes = ["openid", "profile", "email"]

		// const params = [
		// 	["response_type", "code"],
		// 	["client_id", this.config.getClientId()],
		// 	["redirect_uri", `${baseUrl}${this.config.getRedirectUri()}`],
		// 	["state", loginState.state],
		// 	["scope", scopes.join(" ")],
		// ]
		// const searchParams = new URLSearchParams(params)

		// // return `${baseUrl}/realms/gw/protocol/openid-connect/auth?${searchParams.toString()}`
		// return `${baseUrl}/realms/gw/protocol/openid-connect/auth?state=${loginState.state}&machineId=${loginState.machineId}`;
	}

	/**
	 * 获取登录基础URL
	 */
	private getLoginBaseUrl(apiConfig: ProviderSettings): string {
		// 优先使用apiConfiguration中的baseUrl
		if (apiConfig.zgsmBaseUrl) {
			return apiConfig.zgsmBaseUrl
		}

		// 使用默认URL
		return this.config.getDefaultLoginBaseUrl()
	}

	/**
	 * 生成随机字符串
	 */
	private generateRandomString(): string {
		return Math.random().toString(36).substring(2) + Date.now().toString(36)
	}

	/**
	 * 获取机器ID
	 */
	private getMachineId(): string {
		// 使用VSCode的机器ID或生成一个唯一标识
		return vscode.env.machineId
	}

	/**
	 * 登录成功回调
	 */
	protected onLoginSuccess(tokens: AuthTokens): void {
		// 可以在这里添加登录成功后的逻辑
		console.log("用户登录成功")
	}

	/**
	 * 登出回调
	 */
	protected async onLogout() {
		const state = await this.storage.getLoginState()
		const tokens = await this.storage.getTokens()
		// 可以在这里添加登出后的逻辑
		await retryWrapper(
			"onLogout",
			() => this.api.logoutUser(state?.state || tokens?.state, tokens?.access_token),
			undefined,
			1,
		)
	}

	/**
	 * 销毁服务
	 */
	dispose(): void {
		this.stopWaitLoginPolling()
		if (this.tokenRefreshInterval) {
			clearInterval(this.tokenRefreshInterval)
		}
	}
}
