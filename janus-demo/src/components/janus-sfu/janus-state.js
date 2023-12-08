import { onMounted, reactive, ref } from 'vue';
import { initJanus, initPlugin, PluginNames } from '@/util/janus-root';

export let videoRoomHandle = null
export let janus = null
export let initalize = false

export const janusState = reactive({
  currentRoom: null,
  roomListParicipants: [],
})

const callbacksMap = new Map() // string -> function[]
export const registerCallback = (name, handle) => {
  const callbacks = callbacksMap.get(name) || []
  callbacks.push(handle)
  callbacksMap.set(name, callbacks)
}

export const executeCallback = (name) => {
  return (...params) => {
    const list = callbacksMap.get(name) || []
    list.forEach(cb => cb(...params))
  }
}

export const setDomVideoTrack = (domId, track) => {
  const video = document.getElementById(domId)
  if (!video) {
    console.error(`[[[${domId}]]]不存在!`)
    return setTimeout(() => {
      setDomVideoTrack(domId, track)
    }, 500)
  }
  const stream = video.srcObject
  if (stream) {
    // stream.getTracks().forEach(track => {
    //   stream.removeTrack(track)
    // })
    stream.addTrack(track)
  } else {
    const newStream = new MediaStream()
    newStream.addTrack(track)
    video.srcObject = newStream
    video.controls = false;
    video.autoplay = true;
  }
}

let timer = null
const fetchRoomLatest = () => {
  console.log('发起请求获取最新的人数！！！')
  if (!videoRoomHandle || !janusState.currentRoom) {
    return
  }
  clearTimeout(timer)
  timer = setTimeout(() => {
    videoRoomHandle.send({
      message: {
        request: 'listparticipants',
        room: janusState.currentRoom.room
      },
      success: (e) => {
        const { participants } = e
        // state.roomUserCount = participants.length
        janusState.roomListParicipants = participants
        console.log("listparticipants: ", participants)
      }
    })
  }, 300) 
}


export const initJanusAll = async () => {
  if (janus && videoRoomHandle) {
    return { janus, videoRoomHandle }
  }
  initalize = true
  janus = await initJanus()
  videoRoomHandle = await initPlugin(PluginNames.VideoRoom, {
    success: executeCallback('success'),
    // onmessage: executeCallback('onmessage'),
    onmessage: (msg, jsep) => {
      console.log('state omsg: ', msg)
      fetchRoomLatest()
      executeCallback('onmessage')(msg, jsep)
    },
    slowLink: executeCallback('slowLink'),
    webrtcState: executeCallback('webrtcState'),
    onlocaltrack: executeCallback('onlocaltrack'),
    onremotetrack: executeCallback('onremotetrack'),
  })
  initalize = false

  return {
    janus,
    videoRoomHandle
  }
}