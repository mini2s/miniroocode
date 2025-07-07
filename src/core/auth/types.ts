/**
 * 认证模块类型定义
 */

/**
 * 登录状态接口
 */
export interface LoginState {
	/** 登录状态标识符 */
	state: string

	status?: AuthStatus

	/** 机器标识符 */
	machineId?: string
}

/**
 * 认证Token接口
 */
export interface AuthTokens {
	/** 访问令牌 */
	access_token: string
	/** 刷新令牌 */
	refresh_token: string
	/** 本地 state 标记 */
	state: string
}

/**
 * 登录响应接口
 */
export interface LoginResponse {
	/** 是否成功 */
	success: boolean
	/** 认证令牌（成功时返回） */
	tokens?: AuthTokens
	/** 错误信息（失败时返回） */
	error?: string
}

/**
 * 认证状态枚举
 */
export enum AuthStatus {
	/** 未登录 */
	NOT_LOGGED_IN = "not_logged_in",
	/** 登录中 */
	LOGGING_IN = "logging_in",
	/** 已登录 */
	LOGGED_IN = "logged_in",
	/** 登录失败 */
	LOGIN_FAILED = "login_failed",
	/** Token过期 */
	TOKEN_EXPIRED = "token_expired",
}
