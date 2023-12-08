<script setup>
import { videoRoomHandle } from './janus-state'
import { getParam } from '@/util/index'

const props = defineProps({
  list: {
    type: Array,
    default: () => ([
      {
        "room": 1701059355543,
        "description": "test1234",
        "pin_required": true,
        "is_private": false,
        "max_publishers": 3,
        "bitrate": 0,
        "fir_freq": 0,
        "require_pvtid": false,
        "require_e2ee": false,
        "dummy_publisher": false,
        "notify_joining": false,
        "audiocodec": "opus",
        "videocodec": "vp8",
        "opus_fec": true,
        "record": false,
        "lock_record": false,
        "num_participants": 0,
        "audiolevel_ext": true,
        "audiolevel_event": false,
        "videoorient_ext": true,
        "playoutdelay_ext": true,
        "transport_wide_cc_ext": true
      }
    ])
  }
})

const emit = defineEmits(["room"])

const joinRoom = (room) => {
  videoRoomHandle.send({
    message: {
      request: 'join',
      // 作为发布者加入房间
      // ptype: getParam("pub") ? "publisher" : "subscriber",
      ptype: "publisher",
      room: room.room,
      // 保存系统返回的作为用户id
      // id: '',
      id: parseInt(getParam('userId')) || '',
      display: getParam('userId') || `用户${Math.random().toString(16).slice(-4)}`,
      pin: '',
      // feed: ''
    },
    success: () => console.log('正在加入会议室'),
    error: () => console.log("加入失败")
  })
}
</script>

<template>
  <div class="room-list-wrap">
    <div class="room-item" v-for="room in props.list" :key="room.room">
      <div class="room-cover"></div>
      <div class="room-desc">{{ room.description }}</div>
      <div class="room-status">
        <el-link type="primary" @click="joinRoom(room)">加入房间</el-link>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.room-list-wrap {
  padding: 10px 0;
}
.room-item {
  display: inline-flex;
  flex-direction: column;
  width: 320px;
  margin-right: 15px;
  margin-bottom: 15px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 2px 2px 2px #ddd;
  transition: all .3s;
  
  &:hover {
    box-shadow: 4px 4px 4px #ddd;
  }

  .room-cover {
    height: 180px;
    background-color: #333;
  }
  
  .room-desc {
    line-height: 2.5;
    text-indent: 1em;
    background-color: #f2f2f2;
    color: #222;
  }
  .room-status {
    padding: 4px 0;
    padding-left: 15px;
  }
}
</style>