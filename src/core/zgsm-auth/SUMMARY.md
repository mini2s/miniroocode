# 认证模块总结

## 模块结构

```
src/services/auth/
├── authService.ts      # 主要认证服务类
├── authStorage.ts      # 本地存储管理
├── authApi.ts          # API通信接口
├── authConfig.ts       # 配置管理
├── zgsmAuthCommands.ts     # VSCode命令处理器
├── types.ts           # 类型定义
├── index.ts           # 模块导出
├── example.ts         # 使用示例
├── README.md          # 详细文档
├── SUMMARY.md         # 本文件
└── __tests__/
    └── authService.test.ts  # 测试文件
```

## 核心功能

### 1. 浏览器登录流程

- 生成随机的state和machineId
- 在默认浏览器中打开登录页面
- 自动开始轮询检查登录状态

### 2. 轮询机制

- 每5秒调用`getUserLoginState`接口
- 检查用户是否已完成登录
- 登录成功后自动停止轮询

### 3. Token管理

- 自动保存token和refresh_token
- 每30分钟自动刷新token
- 插件启动时验证token有效性

### 4. 本地存储

- 使用VSCode配置API安全存储
- 支持token和登录状态的持久化
- 提供完整的清理机制

## 主要类和方法

### AuthService（主要服务类）

```typescript
class AuthService {
	// 启动登录流程
	async startLogin(): Promise<ZgsmLoginState>

	// 检查登录状态
	async checkLoginStatusOnStartup(): Promise<boolean>

	// 获取当前token
	async getCurrentAccessToken(): Promise<string | null>

	// 刷新token
	async refreshToken(refreshToken: string, machineId: string, state: string): Promise<ZgsmAuthTokens>

	// 登出
	async logout(): Promise<void>

	// 销毁服务
	dispose(): void
}
```

### ZgsmAuthStorage（存储管理）

```typescript
class ZgsmAuthStorage {
	// 保存/获取token
	async saveTokens(tokens: ZgsmAuthTokens): Promise<void>
	async getTokens(): Promise<ZgsmAuthTokens | null>

	// 保存/获取登录状态
	async saveLoginState(loginState: ZgsmLoginState): Promise<void>
	async getLoginState(): Promise<ZgsmLoginState | null>

	// 清理所有数据
	async clearAll(): Promise<void>
}
```

### ZgsmAuthApi（API通信）

```typescript
class ZgsmAuthApi {
	// 获取登录状态
	async getUserLoginState(state: string, machineId: string): Promise<ZgsmLoginResponse>

	// 刷新token
	async getRefreshUserToken(refreshToken: string, machineId: string, state: string): Promise<ZgsmLoginResponse>

	// 验证token
	async validateToken(token: string): Promise<boolean>

	// 发送认证请求
	async makeAuthenticatedRequest<T>(endpoint: string, token: string, options?: RequestInit): Promise<T>
}
```

## 集成方式

### 1. 在extension.ts中集成

```typescript
import { ZgsmAuthCommands } from "./services/auth"

export function activate(context: vscode.ExtensionContext) {
	// 注册认证命令
	const zgsmAuthCommands = new ZgsmAuthCommands()
	zgsmAuthCommands.registerCommands(context)
}
```

### 2. 在registerCommands.ts中集成

```typescript
import { ZgsmAuthCommands } from "../services/auth"

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	// 注册认证相关命令
	const zgsmAuthCommands = new ZgsmAuthCommands()
	zgsmAuthCommands.registerCommands(context)

	// ... 其他命令注册
}
```

### 3. 在package.json中添加命令

```json
{
	"commands": [
		{
			"command": "roo-cline.login",
			"title": "登录",
			"category": "认证"
		},
		{
			"command": "roo-cline.logout",
			"title": "登出",
			"category": "认证"
		}
	]
}
```

## 配置选项

### VSCode设置

```json
{
	"roo-cline.auth.loginBaseUrl": "http://your-domain.com",
	"roo-cline.auth.apiBaseUrl": "http://your-domain.com/api"
}
```

### 默认配置

- 轮询间隔：5秒
- Token刷新间隔：30分钟
- 最大轮询次数：120次（10分钟）
- 请求超时：10秒

## 工作流程

1. **用户点击登录**

    - 生成随机参数
    - 打开浏览器登录页面
    - 开始轮询

2. **轮询检查**

    - 每5秒检查登录状态
    - 成功后保存token
    - 开始定时刷新

3. **Token刷新**

    - 每30分钟自动刷新
    - 更新本地存储
    - 处理刷新失败

4. **插件启动**
    - 检查本地登录信息
    - 验证token有效性
    - 恢复登录状态

## 安全特性

- ✅ 使用HTTPS进行API通信
- ✅ Token安全存储在VSCode配置中
- ✅ 定期刷新token减少风险
- ✅ 支持安全的登出机制
- ✅ 自动清理过期数据

## 错误处理

- ✅ 网络请求失败自动重试
- ✅ Token过期自动清除
- ✅ 轮询超时自动停止
- ✅ 用户友好的错误提示
- ✅ 完整的异常捕获

## 扩展性

- ✅ 支持继承和重写
- ✅ 模块化设计
- ✅ 类型安全
- ✅ 完整的测试覆盖
- ✅ 详细的文档说明

## 使用建议

1. **开发环境**：使用测试服务器进行开发
2. **生产环境**：确保使用HTTPS
3. **错误监控**：添加适当的日志记录
4. **用户体验**：提供清晰的登录状态反馈
5. **安全性**：定期审查和更新安全措施

这个认证模块为VSCode插件提供了完整、安全、易用的登录功能，可以满足大多数认证需求。
