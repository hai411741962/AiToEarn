# 本机 CSDN 发布服务

在与 AiToEarn 网页相同的电脑上运行：

```bash
pnpm install
pnpm start
```

服务只监听 `127.0.0.1:8787`，只允许本机 `localhost:8080`、`localhost:8081` 的网页跨域调用。每个账号使用独立的 Chrome 资料目录；首次登录必须由用户在打开的浏览器窗口完成。资料默认保存在本目录 `.local-data/`，可通过 `LOCAL_PUBLISHER_DATA_DIR` 指向其他私有目录。`CHROME_PATH` 可指定 Chrome 可执行文件。

页面会在提交前再次核对账号身份，并逐个返回 `published`、`submitted_unverified` 或 `failed`。只有取得 CSDN 文章链接时才返回 `published`；平台页面变更、审核或验证码可能使结果停留在待核实状态。当前仅支持 CSDN 文章，视频仍走手动流程。
