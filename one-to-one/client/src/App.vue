<template>
  <div class="video">
    <section class="local-video">
      <video ref="localVideoRef"></video>
    </section>
    <section class="remote-video">
      <video ref="remoteVideoRef"></video>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { initSocket } from './socket'

const emits = defineEmits(['streamSuccess', 'leave'])

const remoteVideoRef = ref(null)
const localVideoRef = ref(null)

onMounted(() => {
  initVideo(localVideoRef.value)
})
// 初始化本地视频
const initVideo = async (video) => {
  if (!video) return
  try {
    let config = {
      // video: true,
      audio: true,
    }
    let stream = await navigator.mediaDevices.getUserMedia(config)
    video.srcObject = stream
    // emits('streamSuccess', { stream, remoteVideoRef })
    streamSuccess({ stream, remoteVideoRef })
    video.play()
  } catch (e) {
    console.log(`error: `, e)
  }
}

const streamSuccess = ({ stream, remoteVideoRef }) => {
  const userInfo = {
    username: 'joey',
    room: 'test'
  }
  const info = { ...userInfo, localStream: stream, remoteVideoRef }
  socket = initSocket(info)
}
</script>
