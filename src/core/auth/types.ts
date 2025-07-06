/**
 * 认证模块类型定义
 */

/**
 * 登录状态接口
 */
export interface LoginState {
	/** 登录状态标识符 */
	state: string

	status: AuthStatus

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
 * 用户信息接口
 */
export interface UserInfo {
	/** 用户ID */
	id: string
	/** 用户名 */
	username: string
	/** 邮箱 */
	email: string
	/** 显示名称 */
	displayName?: string
	/** 头像URL */
	avatarUrl?: string
}

/**
 * 认证配置接口
 */
export interface AuthConfigOptions {
	/** 登录基础URL */
	loginBaseUrl?: string
	/** API基础URL */
	apiBaseUrl?: string
	/** 轮询间隔（毫秒） */
	pollingInterval?: number
	/** Token刷新间隔（毫秒） */
	tokenRefreshInterval?: number
	/** 最大轮询次数 */
	maxPollingAttempts?: number
	/** 请求超时时间（毫秒） */
	requestTimeout?: number
}

/**
 * 认证事件类型
 */
export type AuthEventType =
	| "loginStarted"
	| "loginSuccess"
	| "loginFailed"
	| "logout"
	| "tokenRefreshed"
	| "tokenExpired"

/**
 * 认证事件接口
 */
export interface AuthEvent {
	/** 事件类型 */
	type: AuthEventType
	/** 事件数据 */
	data?: any
	/** 时间戳 */
	timestamp: number
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

/**
 * API请求选项接口
 */
export interface ApiRequestOptions extends RequestInit {
	/** 是否重试 */
	retry?: boolean
	/** 重试次数 */
	retryCount?: number
	/** 重试延迟（毫秒） */
	retryDelay?: number
}

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
	/** 认证Token存储键 */
	TOKENS: "roo-cline.auth.tokens",
	/** 登录状态存储键 */
	LOGIN_STATE: "roo-cline.auth.loginState",
	/** 用户信息存储键 */
	USER_INFO: "roo-cline.auth.userInfo",
	/** 认证配置存储键 */
	CONFIG: "roo-cline.auth.config",
} as const

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
	/** 默认轮询间隔（毫秒） */
	POLLING_INTERVAL: 5000,
	/** 默认Token刷新间隔（毫秒） */
	TOKEN_REFRESH_INTERVAL: 30 * 60 * 1000,
	/** 默认最大轮询次数 */
	MAX_POLLING_ATTEMPTS: 120,
	/** 默认请求超时时间（毫秒） */
	REQUEST_TIMEOUT: 10000,
	/** 默认重试次数 */
	DEFAULT_RETRY_COUNT: 3,
	/** 默认重试延迟（毫秒） */
	DEFAULT_RETRY_DELAY: 1000,
} as const
