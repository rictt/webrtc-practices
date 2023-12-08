<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import CustomVideo from '@/components/custom-video/index.vue'
import { videoRoomHandle, janusState, setDomVideoTrack, registerCallback } from './janus-state';

const props = defineProps({
  room: {
    type: Object,
    default: () => ({
      room: Date.now(),
      // 当前用户ID
      id: '',
      // a different unique ID associated to the participant; meant to be private
      private_id: '',
      // 房间描述
      description: '',
      // 发布者列表
      publishers: [],
      attendees: []
    })
  }
})


const state = reactive({
  roomUserCount: 0
})


const onlocalTrack = (track, added) => {
  console.log('本地媒体监听：', track, added)
  if (added) {
    setDomVideoTrack('localVideo', track)
  }
}

const shareScreen = () => {
  videoRoomHandle.createOffer({
    tracks: [
      { type: 'screen', add: true, capture: true }
    ],
    success: (jsep) => {
      videoRoomHandle.send({
        jsep,
        message: {
          request: "configure",
          video: true
        }
      })
      console.log('send screen success')
    },
    error: (error) => {
      console.log('share error: ', error)
    }
  })
}

const otherUsers = computed(() => {
  if (props.room.id) {
    return janusState.roomListParicipants.filter(e => e.id !== props.room.id)
  }
  return janusState.roomListParicipants
})

registerCallback('onlocaltrack', onlocalTrack)

</script>

<template>
  <div v-if="props.room">
    <div>
      <div>房间：{{ props.room.description }}（{{ props.room.room }}）</div>
      <div>用户ID：{{ props.room.id }}</div>
      <div>在线人数：{{ janusState.roomListParicipants.length }}</div>
    </div>
    <div>
      <el-button @click="shareScreen">分享屏幕</el-button>
    </div>
    <div style="margin: 10px 0;">
      <CustomVideo id="localVideo" label="Local Video" />
      <!-- <CustomVideo id="localVideo" label="Local Video" /> -->
      <CustomVideo 
        v-for="user in otherUsers" 
        :key="user.id" 
        :id="user.id + '-video'"
        :label="user.id + '-video'"
      />
    </div>
  </div>
</template>

<style lang="less" scoped>
</style>