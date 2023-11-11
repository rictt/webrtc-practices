# WebRtc Practices

## 命令工具
- mac查看端口占用：`sudo lsof -i tcp:port`
- 结束进程：`sudo kill -9 PID`

## one to one大致流程

- 准备信令服务器（交换各自的信息，收集房间、用户信息）
- 用户携带用户ID和房间ID进行登录
- 查看房间在线设备
- 进行呼叫
  - 初始化本地的video显示
  - 发送call事件，通过socket转发到对应设备
  - 初始化PeerConnection实例
  - 通过pc创建offer，发送offer事件
- 被呼叫方监听到call事件，处理onCall
  - 初始化pc对象
  - 初始化被呼叫方的video显示
- 被呼叫方监听到offer事件
  - 创建answer对象，发送answer事件
- 呼叫方监听到answer
  - 设置pc对象的remoteDescription
- 双方监听各自pc对象
  - 监听ontrack事件，设置remoteVideo
  - 监听icecandidate，进行协商