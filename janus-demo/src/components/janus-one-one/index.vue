<script setup>
import { onMounted, reactive } from 'vue';
import { getParam } from '@/util/index'
import { initJanus, initPlugin, PluginNames } from '@/util/janus-root'
import Janus from '@/util/janus';
import { ElNotification } from 'element-plus'

let janus = null
let videoCallHandle = null

const form = reactive({
  userId: '',
  userName: '',
  peers: [],
  remoteUserName: '',
  videoStatus: true,
  audioStatus: true,
})

const initPage = () => {
  form.userId = getParam('userId')
  form.userName = getParam('userName')
  if (form.userName && videoCallHandle) {
    videoCallHandle.send({
      message: {
        request: 'register',
        username: form.userName
      }
    })
    videoCallHandle.send({
      message: {
        request: 'list'
      }
    })
  }
}

onMounted(async () => {
  janus = await initJanus()
  videoCallHandle = await initPlugin(PluginNames.VideoCall, {
    onmessage: onJanusMessage,
    onlocaltrack: onLocalTrack,
    onremotetrack: onRemoteTrack
  })
  console.log("videoCallHandle: ", videoCallHandle)

  initPage()
})

const callRemote = (username) => {
  if (!username) {
    return console.error('username empty')
  }
  form.remoteUserName = username
  videoCallHandle.createOffer({
    tracks: [
      // recv: 是否接受音/视频
      // simulcast：对于视频，轨道是否进行联播（是否向SFU服务器发送多路不同分辨率的视频流，1080P、720P、360P等
      // capture：指定媒体设备，true为默认设备，或者设置具体deviceId
      { type: 'audio', capture: true, recv: true },
      { type: 'video', capture: true, recv: true, simulcast: false },
      { type: 'data' },
    ],
    success: (jsep) => {
      const body = {
        request: "call",
        username: username
      }
      videoCallHandle.send({ message: body, jsep })
      console.log('call success: ', body)
    },
    error: (error) => {
      console.error("call remote error: ", error)
    }
  })
}

const onJanusMessage = (message, jsep) => {
  const { result } = message
  if (result && result.list) {
    const peers = []
    const index = (result.list || []).findIndex(e => form.userName && e === form.userName)
    if (index !== -1) {
      const item = result.list.splice(index, 1)[0]
      console.log(item)
      peers.push(item)
    }
    peers.push(...result.list)
    form.peers = peers
    console.log('list: ', result.list)
  }
  if (result && result.event) {
    const { event } = result
    switch (event) {
      case 'incomingcall':
        onInComingCall(jsep, result)
        break
      case 'accepted':
        onAccepted(jsep)
        break
      case 'update':
        onUpdate(jsep)
        break
      case 'hangup':
        onHangup()
        break
      default:
        console.log(`${event}没有处理事件`, jsep)
    }
  }
}

const onHangup = () => {
  videoCallHandle.hangup()
  ElNotification.warning({
    title: '已挂断',
    message: '通话已结束'
  })
}

const onInComingCall = (jsep, result) => {
  videoCallHandle.createAnswer({
    jsep,
    tracks: [
      { type: 'audio', capture: true, recv: true },
      { type: 'video', capture: true, recv: true, simulcast: false },
      { type: 'data' }
    ],
    success: (jsep) => {
      console.log(result)
      form.remoteUserName = result.username
      Janus.debug(`来自应答${result.username}的呼叫`)
      const body = {
        request: "accept"
      }
      videoCallHandle.send({ message: body, jsep })
      console.log('accpet success!', body)
    },
    error: (error) => {
      console.error("创建应答失败", error)
    }
  })
}

const onAccepted = (jsep) => {
  console.log("对方已接听同时设置协商信息", jsep)
  if (jsep) {
    videoCallHandle.handleRemoteJsep({ jsep })
  }
}

const onUpdate = (jsep) => {
  console.log("update: ", jsep)
  if (jsep.type === "answer") {
    videoCallHandle.handleRemoteJsep({ jsep })
  } else {
    videoCallHandle.createAnswer({
      jsep,
      tracks: [
        { type: 'audio', capture: true, recv: true },
        { type: 'video', capture: true, recv: true, simulcast: false },
        { type: 'data' },
      ],
      success: (jsep) => {
        console.log("重新应答信令 SDP!", jsep);
        const body = { request: "set" }
        videoCallHandle.send({ message: body, jsep })
      },
      error: (error) => {
        console.log(error)
      }
    })
  }
}

const hangup = () => {
  videoCallHandle.hangup()
  if (form.userName) {
    clearVideo(form.userName)
  }
  if (form.remoteUserName) {
    clearVideo(form.remoteUserName)
  }
}

const clearVideo = (videoId) => {
  const local = document.getElementById(videoId)
  const stopTrack = (stream) => {
    stream.getTracks().forEach((e) => {
      e.stop()
    })
  }
  if (local && local.srcObject) {
    stopTrack(local.srcObject)
    // local.srcObject = null
  }
}

const setAudioStatus = (status) => {
  form.audioStatus = status
  videoCallHandle && videoCallHandle.send({
    message: {
      request: "set",
      audio: status
    }
  })
  const video = document.getElementById(form.userName)
  if (video && video.srcObject) {
    video.srcObject.getAudioTracks().forEach(track => {
      track.enabled = status
    })
  }
  console.log("set audio status success: ", status)
}

const setVideoStatus = (status) => {
  form.videoStatus = status
  if (status) {
    videoCallHandle.unmuteVideo()
  } else {
    videoCallHandle.muteVideo()
  }
  // videoCallHandle && videoCallHandle.send({
  //   message: {
  //     request: "set",
  //     video: status
  //   }
  // })
  // const video = document.getElementById(form.userName)
  // if (video && video.srcObject) {
  //   video.srcObject.getVideoTracks().forEach(track => {
  //     track.enabled = status
  //   })
  // }
  console.log("set audio status success: ", status)

}

const setShareScreen = async () => {
  const mediaStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  })
  // const { id } = mediaStream
  // console.log('display media id: ', id)
  // videoCallHandle && videoCallHandle.send({
  //   message: {
  //     request: "set",
  //     video: {
  //       deviceId: {
  //         exact: id
  //       }
  //     }
  //   }
  // })
  // videoCallHandle.replaceTracks(mediaStream.getTracks())
  videoCallHandle.replaceTracks({
    tracks: [
      // { type: 'screen', capture: true, recv: true, replace: true, remove: true, simulcast: false, }
      { type: 'screen', capture: true, recv: true, replace: true, simulcast: false, }
    ],
    success: (...params) => {
      console.log('success!: ', params)
    },
    error: (error) => {
      console.log('error: ', error)
    }
  })
  console.log('set share screen success!, ', mediaStream.id)
}

const setRecord = () => {
  videoCallHandle && videoCallHandle.send({
    message: {
      request: "set",
      record: true,
      filename: "/home/janus-docker/record/" + form.userName + '-' + form.remoteUserName
    }
  })
  ElNotification.success({
    title: "正在录制",
    message: "录制中"
  })
}

const onLocalTrack = (track, added) => {
  console.log("本地媒体：", track, added)
  if (added) {
    setDomVideoTrick(form.userName, track)
  }
}

const onRemoteTrack = (track, mid, added) => {
  console.log("远程媒体：", track, mid, added)
  if (added) {
    if (!form.remoteUserName) {
      return console.error('remote username empty')
    }
    setDomVideoTrick(form.remoteUserName, track)
  }
}

const setDomVideoTrick = (domId, track) => {
  const video = document.getElementById(domId)
  const stream = video.srcObject
  if (stream) {
    stream.addTrack(track)
  } else {
    const newStream = new MediaStream()
    newStream.addTrack(track)
    video.srcObject = newStream
    video.controls = false;
    video.autoplay = true;
  }
}

</script>

<template>
  <div class="wrap">
    <el-form label-width="100px" label-position="left">
      <div class="card-wrap">
        <el-card v-for="username in form.peers" :key="username">
          <el-form-item label="用户名">{{ username }}</el-form-item>
          <div class="user-menu-list">
            <template v-if="form.userName === username">
              <el-button type="success" @click="setAudioStatus(!form.audioStatus)">{{ form.audioStatus ? '静音' : '开启麦克风'
              }}</el-button>
              <el-button type="success" @click="setVideoStatus(!form.videoStatus)">{{ form.videoStatus ? '关闭摄像头' : '开启摄像头'
              }}</el-button>
              <el-button type="success" @click="setShareScreen">分享屏幕</el-button>
              <el-button type="success" @click="setRecord">录制</el-button>
            </template>
            <el-button type="danger" v-if="form.userName !== username" @click="hangup">挂断</el-button>
            <el-button type="primary" v-if="form.userName !== username" @click="callRemote(username)">呼叫</el-button>
          </div>
          <video :id="username" class="video-item" src="" controls></video>
        </el-card>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="less">
.wrap {
  width: 100%;
  min-width: 800px;
  display: flex;
}

:deep(.el-form) {
  width: 100%;
}

.user-menu-list {
  display: flex;
  margin-bottom: 10px;
}

.card-wrap {
  display: flex;
  width: 100%;
  gap: 10px 20px;
  flex-wrap: wrap;
  justify-content: center;

  .el-card {
    flex: 1;
    max-width: calc(40% - 20px);
    min-width: calc(40% - 20px);

    // min-width: 450px;
    .el-card__body {
      padding: 10px;
    }
  }
}

.video-item {
  display: block;
  width: 100%;
}
</style>
