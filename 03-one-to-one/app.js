const httpServer = require('http').createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json;charset=utf-8",
    "access-control-allow-origin": "*"
  })
});
const io = require('socket.io')(httpServer, {
  cors: {
    origin: "*"
  }
})
const redis = require('redis')

const redisClient = redis.createClient(6379, '127.0.0.1')
const roomKey = "metting-room::"

redisClient.on('error', function (error) {
  console.log('redisCLient error: ', error)
  console.log('检查是不是redis服务没启动，启动命令为：redis-server')
})

const userMap = new Map() // user => socket

io.on('connection', async (socket) => {
  await onListener(socket)
})

httpServer.listen(18080, async () => {
  console.log('服务器启动: ' + 'http://localhost:18080')
  await redisClient.connect();
  console.log('redis链接成功')
})

function getMsg(type, msg, status = 200, data = null) {
  return { type, msg, status, data }
}

function getParam(url, queryName) {
  let query = decodeURI(url.split('?')[1]);
  let vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] === queryName) {
      return pair[1];
    }
  }
  return null;
}

function getUseryDetailByUID(userId, roomId, nickname) {
  let res = JSON.stringify({
    userId,
    roomId,
    nickname
  })
  return res
}

async function onListener(socket) {
  let url = socket.client.request.url
  let userId = getParam(url, 'userId')
  let roomId = getParam(url, 'roomId')
  let nickname = getParam(url, 'nickname')
  console.log(userId, roomId, nickname)

  userMap.set(userId, socket)
  if (roomId) {
    console.log(getUseryDetailByUID(userId, roomId, nickname))
    await redisClient.hSet(roomKey + roomId, userId + '', getUseryDetailByUID(userId, roomId, nickname))
    oneToMany(roomId, getMsg('join', userId + ' join the room', 200, userId))
  }

  socket.on('msg', async (data) => {
    await oneToMany(roomId, data)
  })

  socket.on('disconnect', async () => {
    console.log('user: ', userId + ", roomId: " + roomId + " offline!")
    userMap.delete(userId)
    if (roomId) {
      await redisClient.hDel(roomKey + roomId, userId)
      oneToMany(roomId, getMsg('leave', userId + ' leave the room', 200, userId))
    }
  })

  socket.on('roomUserList', async (data) => {
    console.log('roomUserList: ', data)
    socket.emit('roomUserList', await getRoomUser(data['roomId']))
  })

  socket.on('call', (data) => {
    let targetUid = data['targetUid']
    if (userMap.get(targetUid)) {
      oneToOne(targetUid, getMsg('call', "call", 200, data))
    } else {
      console.log('user: ' + targetUid + ' is offline')
    }
  })

  socket.on('candidate', (data) => {
    const targetUid = data['targetUid']
    if (userMap.get(targetUid)) {
      oneToOne(targetUid, getMsg('candidate', 'ice candidate', 200, data))
    } else {
      console.log('candidate not found: ', targetUid)
    }
  })

  socket.on('offer', (data) => {
    const targetUid = data['targetUid']
    if (userMap.get(targetUid)) {
      oneToOne(targetUid, getMsg('offer', 'rtc offer', 200, data))
    } else {
      console.log('offer not found: ', targetUid)
    }
  })

  socket.on('answer', (data) => {
    const targetUid = data['targetUid']
    if (userMap.get(targetUid)) {
      oneToOne(targetUid, getMsg('answer', 'rtc answer', 200, data))
    } else {
      console.log('answer not found: ', targetUid)
    }
  })
}

function oneToOne(uid, msg) {
  let socket = userMap.get(uid)
  if (socket) {
    socket.emit('msg', msg)
  }
}

async function getRoomUser(roomId) {
  return await redisClient.hGetAll(roomKey + roomId)
}

async function oneToMany(roomId, msg) {
  let uList = await redisClient.hGetAll(roomKey + roomId)
  for (const uid in uList) {
    oneToOne(uid, msg)
  }
}