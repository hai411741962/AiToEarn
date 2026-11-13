# ChannelManager

频道管理负责展示已连接账号、添加平台频道，以及引导未接入平台的手动发布。

- `components/ConnectChannelList.tsx`：平台入口与内容类型筛选。
- `components/ManualPublishDialog.tsx`：百家号、CSDN、知乎的手动发布稿件；CSDN 文章另显示本机自动发布入口。
- `components/CsdnAutoPublishPanel/index.tsx`：通过本机 `local-publisher` 管理独立 CSDN 登录会话，选择多个账号提交文章并显示逐账号结果。

CSDN 登录资料和账号记录仅由 `scripts/local-publisher` 持有。页面只读取账号标签、已验证的身份和发布结果，不读取 Cookie。
