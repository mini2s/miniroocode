/**
 * ClineProvider认证集成示例
 *
 * 这个文件展示了如何在ClineProvider中集成和使用认证功能
 */

import * as vscode from "vscode"
import { ZgsmAuthService } from "./authService"
import type { ClineProvider } from "../webview/ClineProvider"

/**
 * 扩展ClineProvider以支持认证功能
 */
export class AuthenticatedClineProvider {
	private authService: ZgsmAuthService
	private clineProvider: ClineProvider

	constructor(clineProvider: ClineProvider) {
		this.clineProvider = clineProvider
		this.authService = ZgsmAuthService.getInstance().setClineProvider(clineProvider)
	}

	/**
	 * 检查用户是否已登录
	 */
	async isUserLoggedIn(): Promise<boolean> {
		const token = await this.authService.getCurrentAccessToken()
		return !!token
	}

	/**
	 * 获取当前认证token
	 */
	async getAuthToken(): Promise<string | null> {
		return await this.authService.getCurrentAccessToken()
	}

	/**
	 * 启动登录流程
	 */
	async startLogin(): Promise<void> {
		try {
			await this.authService.startLogin()
		} catch (error) {
			console.error("登录失败:", error)
			throw error
		}
	}

	/**
	 * 登出
	 */
	async logout(): Promise<void> {
		try {
			await this.authService.logout()
		} catch (error) {
			console.error("登出失败:", error)
			throw error
		}
	}

	/**
	 * 使用认证token进行API调用
	 */
	async makeAuthenticatedApiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const token = await this.getAuthToken()

		if (!token) {
			throw new Error("用户未登录，请先登录")
		}

		// 这里可以添加使用token进行API调用的逻辑
		// 例如：调用ClineProvider的API方法
		return {} as T
	}

	/**
	 * 检查并确保用户已登录
	 */
	async ensureLoggedIn(): Promise<boolean> {
		if (await this.isUserLoggedIn()) {
			return true
		}

		// 显示登录提示
		const action = await vscode.window.showInformationMessage("需要登录才能使用此功能", "登录", "取消")

		if (action === "登录") {
			await this.startLogin()
			return true
		}

		return false
	}

	/**
	 * 在任务执行前检查认证状态
	 */
	async beforeTaskExecution(): Promise<boolean> {
		return await this.ensureLoggedIn()
	}

	/**
	 * 获取认证状态信息
	 */
	async getAuthStatus(): Promise<{
		isLoggedIn: boolean
		hasValidToken: boolean
		tokenExpiry?: Date
	}> {
		const isLoggedIn = await this.isUserLoggedIn()
		const token = await this.getAuthToken()

		return {
			isLoggedIn,
			hasValidToken: !!token,
			// 这里可以添加token过期时间的检查
		}
	}
}

/**
 * 在ClineProvider中集成认证功能的示例
 */
export function integrateAuthWithClineProvider(clineProvider: ClineProvider): AuthenticatedClineProvider {
	return new AuthenticatedClineProvider(clineProvider)
}

/**
 * 认证状态监听器
 */
export class AuthStatusListener {
	private authService: ZgsmAuthService
	private listeners: Array<(isLoggedIn: boolean) => void> = []

	constructor(authService: ZgsmAuthService) {
		this.authService = authService
	}

	/**
	 * 添加认证状态变化监听器
	 */
	onAuthStatusChange(listener: (isLoggedIn: boolean) => void): void {
		this.listeners.push(listener)
	}

	/**
	 * 移除认证状态变化监听器
	 */
	removeAuthStatusListener(listener: (isLoggedIn: boolean) => void): void {
		const index = this.listeners.indexOf(listener)
		if (index > -1) {
			this.listeners.splice(index, 1)
		}
	}

	/**
	 * 通知所有监听器
	 */
	private notifyListeners(isLoggedIn: boolean): void {
		this.listeners.forEach((listener) => {
			try {
				listener(isLoggedIn)
			} catch (error) {
				console.error("认证状态监听器执行失败:", error)
			}
		})
	}

	/**
	 * 开始监听认证状态变化
	 */
	startListening(): void {
		// 这里可以实现定期检查认证状态的逻辑
		setInterval(async () => {
			const isLoggedIn = (await this.authService.getCurrentAccessToken()) !== null
			this.notifyListeners(isLoggedIn)
		}, 60000) // 每分钟检查一次
	}
}

/**
 * 认证相关的UI更新器
 */
export class AuthUIUpdater {
	private clineProvider: ClineProvider
	private authService: ZgsmAuthService

	constructor(clineProvider: ClineProvider, authService: ZgsmAuthService) {
		this.clineProvider = clineProvider
		this.authService = authService
	}

	/**
	 * 更新UI显示登录状态
	 */
	async updateLoginStatusUI(): Promise<void> {
		const isLoggedIn = (await this.authService.getCurrentAccessToken()) !== null

		// 向webview发送认证状态更新消息
		// 注意：这里需要根据实际的webview消息类型进行调整
		this.clineProvider.postMessageToWebview({
			type: "state",
			isLoggedIn,
			timestamp: Date.now(),
		} as any)
	}

	/**
	 * 显示登录提示
	 */
	async showLoginPrompt(): Promise<void> {
		const action = await vscode.window.showInformationMessage("需要登录才能使用完整功能", "立即登录", "稍后再说")

		if (action === "立即登录") {
			await this.authService.startLogin()
		}
	}

	/**
	 * 显示登录成功消息
	 */
	showLoginSuccessMessage(): void {
		vscode.window.showInformationMessage("登录成功！欢迎使用我们的服务")
	}

	/**
	 * 显示登出成功消息
	 */
	showLogoutSuccessMessage(): void {
		vscode.window.showInformationMessage("已成功退出登录")
	}
}
