import adapter from 'webrtc-adapter'
import Janus from './janus'

let janus = null
let opaqueId = `videocall-${Janus.randomString(12)}`;

export const getJanus = () => {
  if (!janus) {
    janus = initJanus()
  }
  return janus
}

export const PluginNames = {
  VideoCall: "janus.plugin.videocall",
  VideoRoom: "janus.plugin.videoroom",
}

export const PluginHandles = {}

export const getVideoCallHandle = () => {
  return PluginHandles[PluginNames.VideoCall]
}

export const initJanus = () => {
  return new Promise((resolve) => {
    Janus.init({
      debug: true,
      dependencies: Janus.useDefaultDependencies({
        adapter: adapter
      }),
      callback: () => {
        if (!Janus.isWebrtcSupported()) {
          Janus.log('is not Supported Webrtc!');
          return;
        }
      }
    });
    //客户端唯一标识
    console.log("opaqueId", opaqueId)
    // 注册：
    janus = new Janus({
      server: 'http://119.91.143.19:18088/janus',
      apisecret: 'joeytest',
      success: function () {
        resolve(janus)
        Janus.log("初始化成功")
        // initJanusPlugin()
        // initPlugin(PluginNames.VideoCall)
      },
      error: function (cause) {
        Janus.log(cause)
      },
      destroyed: function () {
        Janus.log("destroyed")
      }
    });
  
    return janus
  })
}



export const initPlugin = (pluginName, options = {}) => {
  // call when janus init successful!
  if (!janus) {
    return console.error('janus not found!')
  }

  return new Promise((resolve) => {
    janus.attach({
      opaqueId: opaqueId,
      plugin: pluginName,
      ...options,
      success: function(handle) {
        PluginHandles[pluginName] = handle
        resolve(handle)
        options.success && options.success(handle)
      },
      error: function(cause) {
        console.log(cause)
        options.error && options.error(cause)
      },
      onmessage: function(msg, jsep) {
        options.onmessage && options.onmessage(msg, jsep)
        // jsep: 协商信令
      },
      onlocaltrack: function(track, added) {
        Janus.debug("Local track " + (added ? "added" : "removed") + ":", track);
        // 本地流
        options.onlocaltrack && options.onlocaltrack(track, added)
      },
      onremotetrack: function(track, mid, added) {
        // 远端媒体流
        options.onremotetrack && options.onremotetrack(track, mid, added)
      },
    })
  })
}