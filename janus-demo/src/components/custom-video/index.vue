<script setup>
const props = defineProps({
  id: {
    type: [String, Number],
    required: true
  },
  label: {
    type: String
  },
  src: {
    type: String,
    default: ""
  }
})
</script>

<template>
  <div class="video-wrapper">
    <div class="video-label">{{ label || 'Unknow Video' }}</div>
    <div class="video-inner">
      <video class="video" :id="props.id" :src="props.src" v-bind="$attrs"></video>
    </div>
  </div>
</template>

<style lang="less" scoped>
.video-wrapper {
  display: inline-block;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #c3bfbf;
  margin-right: 10px;
  margin-bottom: 10px;

  .video-label {
    padding: 6px 12px;
    font-weight: bold;
    background-color: #ddd;
    color: #5e5d5d;
    border-bottom: 1px solid #c3bfbf;
  }

  .video-inner {
    padding: 12px;
    border-radius: 4px;
    overflow: hidden;
    
    .video {
      width: 320px;
      height: 240px;
      border-radius: 4px;
      overflow: hidden;
    }
  }
}
</style>