/**
 * 认证模块使用示例
 *
 * 这个文件展示了如何在VSCode插件中使用认证模块
 */

import * as vscode from "vscode"
import { ZgsmAuthService, AuthCommands, AuthConfig } from "./index"

/**
 * 示例：在插件激活时初始化认证服务
 */
export function initializeAuthService(context: vscode.ExtensionContext) {
	// 创建认证服务实例
	const authService = ZgsmAuthService.getInstance()

	// 创建命令处理器
	const authCommands = AuthCommands.getInstance()

	// 注册认证相关命令
	authCommands.registerCommands(context)

	// 插件启动时检查登录状态
	authService.checkLoginStatusOnStartup().then((isLoggedIn: boolean) => {
		if (isLoggedIn) {
			console.log("用户已登录")
			vscode.window.showInformationMessage("欢迎回来！")
		} else {
			console.log("用户未登录")
			vscode.window.showInformationMessage("请登录以使用完整功能")
		}
	})

	return { authService, authCommands }
}

/**
 * 示例：自定义认证服务
 */
export class CustomAuthService extends ZgsmAuthService {
	constructor() {
		super()
	}

	/**
	 * 重写登录成功回调
	 */
	protected override onLoginSuccess(tokens: any): void {
		super.onLoginSuccess(tokens)

		// 自定义登录成功后的逻辑
		vscode.window.showInformationMessage("登录成功！欢迎使用我们的服务")

		// 可以在这里添加其他逻辑，比如：
		// - 更新UI状态
		// - 发送分析事件
		// - 初始化用户特定的功能
	}

	/**
	 * 重写登出回调
	 */
	protected override async onLogout() {
		super.onLogout()

		// 自定义登出后的逻辑
		vscode.window.showInformationMessage("已退出登录，感谢使用我们的服务")

		// 可以在这里添加其他逻辑，比如：
		// - 清理用户数据
		// - 重置UI状态
		// - 发送分析事件
	}
}

/**
 * 示例：配置认证服务
 *
 * 注意：AuthConfig类使用默认配置，如需自定义配置，
 * 可以通过继承AuthConfig类来重写相关方法
 */
export async function configureAuthService() {
	const config = AuthConfig.getInstance()

	// 获取默认配置
	const loginBaseUrl = config.getDefaultLoginBaseUrl()
	const apiBaseUrl = config.getDefaultApiBaseUrl()

	console.log("认证服务配置:", {
		loginBaseUrl,
		apiBaseUrl,
		pollingInterval: config.getWaitLoginPollingInterval(),
		tokenRefreshInterval: config.getTokenRefreshInterval(),
	})

	console.log("认证服务配置完成")
}

/**
 * 示例：使用认证服务进行API调用
 */
export async function makeAuthenticatedApiCall(authService: ZgsmAuthService) {
	try {
		// 获取当前token
		const token = await authService.getCurrentAccessToken()

		if (!token) {
			throw new Error("用户未登录")
		}

		// 使用token进行API调用
		const response = await fetch("https://api.example.com/user/profile", {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			throw new Error(`API调用失败: ${response.status}`)
		}

		const userData = await response.json()
		console.log("用户数据:", userData)

		return userData
	} catch (error) {
		console.error("API调用失败:", error)
		throw error
	}
}

/**
 * 示例：监听认证状态变化
 */
export function setupAuthStatusListener(authService: ZgsmAuthService) {
	// 这里可以添加事件监听器
	// 注意：实际的AuthService可能需要实现事件发射器

	console.log("认证状态监听器已设置")
}

/**
 * 示例：完整的认证流程
 */
export async function completeAuthFlow() {
	const authService = ZgsmAuthService.getInstance()

	try {
		// 1. 检查是否已登录
		const isLoggedIn = await authService.checkLoginStatusOnStartup()

		if (isLoggedIn) {
			console.log("用户已登录，无需重新登录")
			return
		}

		// 2. 启动登录流程
		console.log("开始登录流程...")
		const loginState = await authService.startLogin()
		console.log("登录状态:", loginState)

		// 3. 等待用户完成登录（这里只是示例，实际应该通过轮询或回调）
		console.log("请在浏览器中完成登录...")

		// 4. 获取token
		const token = await authService.getCurrentAccessToken()
		if (token) {
			console.log("登录成功，token已获取")
		}
	} catch (error) {
		console.error("认证流程失败:", error)
		vscode.window.showErrorMessage(`认证失败: ${error}`)
	}
}
