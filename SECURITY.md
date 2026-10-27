# Security Policy

## 设计上的安全边界

`dsh-bili-manager` 是一个**本地 host 半端插件**，所有动作都发生在用户自己的机器上：

- 凭据只从本地文件读取（默认 `~/.dsh/bili-main/credentials.json`），不上传、不写日志
- 工具输出中**不包含** cookie / token
- 写操作（评论、置顶、弹幕）默认关闭，需显式开启 `enableWrite`
- 单次会话写操作有上限（`maxWritesPerSession`，默认 10）
- 不实现：私信、删稿、删评论、关注/取关、账号设置、钱包操作

## 报告漏洞

如果你发现安全问题，请通过 GitHub Issues 报告（不要公开敏感细节），或直接联系仓库维护者。
