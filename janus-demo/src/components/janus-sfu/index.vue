<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus'
import RoomList from './room-list.vue';
import Room from './room.vue'
import { PluginNames } from '@/util/janus-root'
import Janus from '@/util/janus'
import { janusState, initJanusAll, setDomVideoTrack, videoRoomHandle, registerCallback, janus } from './janus-state'

const state = reactive({
  roomFormVisible: false,
  fullLoading: false,
  roomListData: [],
  publishers: []
})

const roomForm = reactive({
  description: '',
  secret: '',
  pin: '',
  is_private: false,
  rules: {
    description: [
      { required: true, message: '不能为空' }
    ]
  }
})

const roomFormRef = ref()

const registerJanusCallback = () => {
  registerCallback('success', () => {
    setTimeout(() => {
      fetchRoomList()
    }, 1)
  })
  registerCallback('onmessage', onJanusMessage)
  registerCallback('slowLink', (uplink, mid, lost) => {
    // console.log(`janus问题报告${uplink ? 'sending' : 'receiving'} packets on mid ${mid} (${lost} lost packets)`)
  })
  registerCallback('webrtcState', (on) => {
    // console.log(`WebRTC PeerConnection 状态 is ${on ? 'up' : 'down'} now!`)
  })
}
onMounted(async () => {
  registerJanusCallback()
  await initJanusAll()
})

const onJanusMessage = (msg, jsep) => {
  // console.log(msg, jsep)
  if (jsep) {
    // 设置远程描述
    videoRoomHandle.handleRemoteJsep({ jsep })
  }
  // console.log("videoRoomHandle: ", videoRoomHandle)
  const { videoroom } = msg
  switch (videoroom) {
    case 'joined':
      janusState.currentRoom = msg
      publisherStream()
      if (msg.publishers) {
        const publishers = msg.publishers
        console.log("publishers: ", publishers)
        state.publishers = publishers
        for (const pub of publishers) {
          console.log("pub: ", pub)
          // localPubDomPush(pub.id, pub.display)
          subscriberMedia(pub)
        }
      }
      break
    case 'event':
      if (msg.publishers) {
        // 房间用户监听到媒体变更
        const list = msg.publishers
        for (const pub of list) {
          subscriberMedia(pub)
        }
      }
      break
  }
}

const subscriberMedia = (pub) => {
  // console.log("订阅的用户信息：", pub)
  let pluginHandle = null
  const subscription = []
  janus.attach({
    plugin: PluginNames.VideoRoom,
    error: console.error,
    success: (handle) => {
      pluginHandle = handle
      const streams = pub.streams
      for (const stream of streams) {
        console.log("stream: ", stream)
        // If the publisher is VP8/VP9 and this is an older Safari, let's avoid video
        if (stream.type === "video" && Janus.webRTCAdapter.browserDetails.browser === "safari" &&
          (stream.codec === "vp9" || (stream.codec === "vp8" && !Janus.safariVp8))) {
          console.warn("Publisher is using " + stream.codec.toUpperCase +
            ", but Safari doesn't support it: disabling video stream #" + stream.mindex);
          continue;
        }
        subscription.push({
          feed: pub.id,
          mid: stream.mid
        })
        pluginHandle.rfid = pub.id
        pluginHandle.rfdisplay = pub.display;
      }
      const subscriber = {
        request: "join",
        use_msid: false, // 订阅是否应包含引用发布者的msid
        room: janusState.currentRoom.room,
        autoupdate: true, // 离开房间是否自动发送sdp
        ptype: "subscriber",
        streams: subscription,
        pin: ""
      }
      pluginHandle.send({ message: subscriber })
    },
    onmessage: (msg, jsep) => {
      // console.log('订阅者收到监听：', msg, jsep)
      const event = msg.videoroom
      if (jsep) {
        // pluginHandle.handleRemoteJsep({ jsep })
        pluginHandle.createAnswer({
          jsep,
          tracks: [
            { type: 'data' }
          ],
          error: console.error,
          success: (jsep) => {
            Janus.debug("Got SDP!", jsep);
            const body = {
              request: "start",
              room: janusState.currentRoom.room,
            }
            pluginHandle.send({ message: body, jsep })
          }
        })
      }

      switch(event) {
        case 'attached':
          console.log(`订阅用户${pub.display}媒体信息成功`)
          break
      }
    },
    onremotetrack: (track, mid, added) => {
      let obj = {
        track,
        mid,
        added,
        userId: pub.id,
        display: pub.display,
        trackKind: track.kind
      }

      // console.log('订阅媒体变更：', obj)

      let mediaDomId = pub.id + '-video'
      console.log('remote tracks: ', track, mid, added)
      if (added) {
        setDomVideoTrack(mediaDomId, track)
        // const video = document.createElement('video')
        // video.muted = true
        // video.controls = true
        // video.autoplay = true
        // video.style.width = '300px'
        // video.style.height = '300px'
        // video.style.border = '1px solid blue'
        // video.setAttribute('id', mediaDomId)
        // const stream = new MediaStream()
        // stream.addTrack(track)
        // video.srcObject = stream
        // document.body.appendChild(video)
      } else {
        // remove or stop the video
      }
    }
  })
}

const publisherStream = () => {
  // send offer
  videoRoomHandle.createOffer({
    tracks: [
      // { type: 'audio', capture: true, recv: false },
      { type: 'video', capture: true, recv: false },
      // { type: 'screen', capture: true, recv: false },
      { type: 'data' },
    ],
    success: function (jsep) {
      // console.log("发布者 SDP!", jsep);
      const publish = {
        request: "configure", 
        // audio: true, 
        video: true, 
        restart: true
      }
      videoRoomHandle.send({ message: publish, jsep: jsep });
    },
    error: function (error) {
      console.error("WebRTC error:", error);
    }
  })
}

const fetchRoomList = () => {
  return new Promise((resolve, reject) => {
    state.fullLoading = true
    videoRoomHandle.send({
      message: { request: 'list' },
      success: (result) => {
        resolve(result.list || [])
        state.roomListData = result.list
        state.fullLoading = false
      },
      error: (error) => {
        reject(error)
        state.fullLoading = false
      }
    })
  })
}

const showCreateRoomForm = () => {
  state.roomFormVisible = true
}

const createRoom = () => {
  const createRoomMessage = () => {
    state.fullLoading = true
    videoRoomHandle.send({
      message: {
        request: "create",
        room: Date.now(),
        permanent: false,
        description: roomForm.description,
        secret: roomForm.secret,
        pin: roomForm.pin,
        is_private: roomForm.is_private,
      },
      success: (res) => {
        state.fullLoading = false
        state.roomFormVisible = false
        ElMessage.success('创建成功')
      },
      error: () => {
        state.fullLoading = false
      }
    })
  }
  roomFormRef.value.validate((isValid) => {
    if (!isValid) {
      return
    }
    createRoomMessage()
  })
}


</script>

<template>
  <div v-loading="state.fullLoading">
    <div>
      <el-button type="primary" @click="showCreateRoomForm">创建房间</el-button>
    </div>
    <div v-if="!janusState.currentRoom">
      <RoomList :list="state.roomListData" />
    </div>

    <div v-if="janusState.currentRoom">
      <Room :room="janusState.currentRoom" />
    </div>
  </div>
  <el-drawer v-model="state.roomFormVisible" title="创建房间">
    <el-form ref="roomFormRef" :model="roomForm" :rules="roomForm.rules" label-width="100">
      <el-form-item label="房间名称" prop="description">
        <el-input v-model="roomForm.description" />
      </el-form-item>
      <el-form-item label="进入密码" prop="pin">
        <el-input v-model="roomForm.pin" />
      </el-form-item>
      <el-form-item label="管理密码" prop="secret">
        <el-input v-model="roomForm.secret" />
      </el-form-item>
      <el-form-item label="是否私密" prop="is_private">
        <el-switch v-model="roomForm.is_private" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div style="flex: auto">
        <el-button @click="form.roomFormVisible = false">取消</el-button>
        <el-button type="primary" @click="createRoom">确 认</el-button>
      </div>
    </template>
  </el-drawer>
</template>