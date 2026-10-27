# dsh-bili-manager

DSH（DeepSeek Harness）插件：**B站 账号运营工具箱**。

给养鱼号 / UP 主用的 host 半端插件（无前端界面），把常用的运营动作变成模型可调用的工具：

| 工具 | 作用 | 读/写 |
|---|---|---|
| `bili_manage_whoami` | 看当前登录账号（校验凭据） | 只读 |
| `bili_manage_stats` | 创作中心数据：总览 / 播放来源 / 粉丝路人 / 趋势 | 只读 |
| `bili_manage_reply` | 发评论 / 回复评论 | 写（需开启） |
| `bili_manage_pin` | 置顶 / 取消置顶评论 | 写（需开启） |
| `bili_manage_danmaku` | 发弹幕 | 写（需开启） |

## 安装

```powershell
# 本地目录安装（开发中）
dsh plugin --profile desktop add link:C:\path\to\dsh-bili-manager

# 发布到 npm 后
dsh plugin --profile desktop add dsh-bili-manager
```

## 配置凭据

插件从本地文件读取 cookie（**不会上传、不会写日志**），默认路径：

```
~/.dsh/bili-main/credentials.json
```

格式：

```json
{
  "sessdata": "xxx",
  "bili_jct": "xxx",
  "buvid3": "xxx",
  "dedeuserid": "123456"
}
```

也可以在插件配置里用 `credentialPath` 指定别的路径。

## 配置项

| 字段 | 默认 | 说明 |
|---|---|---|
| `credentialPath` | 空 | 凭据文件路径（空 = 默认路径） |
| `enableWrite` | `false` | **写操作总开关**；关着时所有写工具直接拒绝 |
| `maxWritesPerSession` | `10` | 单次会话写操作上限，防刷屏 |

```yaml
# profile patch 示例
- insert:
    - id: bili-manager
      name: dsh-bili-manager
      config:
        enableWrite: true
        maxWritesPerSession: 5
```

## 实测状态（截至 v0.1.0）

| 能力 | 状态 | 说明 |
|---|---|---|
| `whoami` | ✅ 实测通过 | 返回账号昵称 / 等级 / 硬币 |
| `stats` 总览 | ✅ 实测通过 | 创作中心总量、增量、粉丝、点赞等 |
| `stats` 7 天趋势 | ✅ 实测通过 | 返回 7 天播放趋势点 |
| `stats` 播放来源 | ⚠️ 新号暂无数据 | 接口返回空（不是报错），播放量起来后才有 |
| `reply` / `pin` / `danmaku` | 🛡️ 已实现、默认关闭 | 写操作受 `enableWrite` 与单会话上限约束；代码路径未在公开视频中演示实发 |
| 私信 / 删稿 / 改密码 | ❌ 不提供 | 有意不实现 |

> 视频里 `source: pending` 指的是「播放来源」这一项没数据；其余只读接口是真的返回成功的。

演示脚本（录屏用，输出脱敏）：

```powershell
node examples/showcase.mjs
```

## 安全设计

- 凭据只从本地文件读；工具输出里不含 cookie
- 写操作默认关闭，且受单次会话上限约束
- 只做 5 个明确动作，不碰私信 / 删除 / 账号设置 / 钱包
- 所有工具失败返回结构化错误，不会中断插件

## 自检

```powershell
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" selftest.mjs
```

只读验证：读凭据 → whoami → 拉创作中心总览/趋势，全程不写。

## 开发

- `index.js` —— Cordis 插件入口（`name` / `inject` / `Config` / `apply`）
- `lib/bili.mjs` —— 纯 fetch 实现的 B站 API（无第三方依赖）
- `selftest.mjs` —— 只读自检（需真实凭据）
- `test/plugin.test.mjs` —— 插件级测试（模拟 Cordis 上下文，CI 可跑）
- `cordis.patch.yml` —— 插件挂载声明

## 测试

```powershell
node test/plugin.test.mjs
```

## License

MIT

