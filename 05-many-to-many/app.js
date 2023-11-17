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
const roomListKey = "room-list"

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
    nickname,
  })
  return res
}

async function onListener(socket) {
  let url = socket.client.request.url
  let userId = getParam(url, 'userId')
  let roomId = getParam(url, 'roomId')
  let nickname = getParam(url, 'nickname')
  console.log(userId)

  userMap.set(userId, socket)
  if (roomId) {
    await redisClient.hSet(roomKey + roomId, userId + '', getUseryDetailByUID(userId, roomId, nickname))
    oneToMany(roomId, getMsg('join', userId + ' join the room', 200, userId))
  }

  socket.on('msg', async (data) => {
    await oneToMany(roomId, data)
  })

  socket.on('createRoom', async (data) => {
    const { userId, roomName } = data
    const roomId = Math.random().toString(16).slice(-12)
    const room = {
      roomId,
      roomName: roomName || '自定义房间',
      ownerId: userId,
      status: -1,
      userList: []
    }
    if (roomId) {
      await redisClient.lPush(roomListKey, JSON.stringify(room))
    }

  })

  const emitRoomListToSockets = async () => {
    const roomList = (await redisClient.lRange(roomListKey, 0, 10000) || []).map(e => JSON.parse(e))
    for (let i = 0; i < roomList.length; i++) {
      const room = roomList[i]
      const hashKey = roomKey + room.roomId
      const values = await redisClient.hGetAll(hashKey)
      const list = Array.from(Object.values(values))
      room.userList = list.length ? list : []
    }
    console.log('roomList len', roomList.length)
    userMap.forEach(socket => {
      socket.emit('roomList', roomList)
    })
  }

  socket.on('roomList', async () => {
    await emitRoomListToSockets()
  })

  const findAndUpdateRoomStatus = async (status) => {
    if (!roomId && !userId) {
      return
    }
    const roomList = (await redisClient.lRange(roomListKey, 0, 10000) || []).map(e => JSON.parse(e))
    let index = -1
    let target = null
    for (let i = 0; i < roomList.length; i++) {
      const room = roomList[i]
      if (room.ownerId === userId) {
      // if (room.roomId === roomId) {
        room.status = status
        target = room
        index = i
        break
      }
    }
    if (index !== -1 && target) {
      await redisClient.lSet(roomListKey, index, JSON.stringify(target))
    }
    emitRoomListToSockets()
  }

  socket.on('roomStatus', async (data) => {
    const { roomId, status } = data
    findAndUpdateRoomStatus(status)
  })

  socket.on('joinRoom', async (data) => {
    const { userId, nickname, roomId: _roomId } = data
    console.log(`${userId} join ${_roomId} room`)
    roomId = _roomId
    if (roomId) {
      const hashKey = roomKey + roomId
      await redisClient.hSet(hashKey, userId, getUseryDetailByUID(userId, roomId, nickname || userId))
      oneToMany(roomId, getMsg('join', userId + ' join the room', 200, userId))
    }
  })

  const onUserLeaveOrLeaveRoom = async (userId, roomId) => {
    if (roomId) {
      console.log(`user: ${userId} and roomId ${roomId} leave!`)
      const hashKey = roomKey + roomId
      await redisClient.hDel(hashKey, userId)
      oneToMany(roomId, getMsg('leave', userId + ' leave the room', 200, userId))
      await emitRoomListToSockets()
    }
  }

  socket.on('roomSharer', async (data) => {
    const { roomId, userId: shareUserId } = data
    const roomUserList = await redisClient.hGetAll(roomKey + roomId)
    console.log('room share room user list: ', roomUserList)
    for (const userId of Object.keys(roomUserList)) {
      const u_socket = userMap.get(userId)
      if (u_socket) {
        const roomSharer = {
          userId: shareUserId,
          roomId
        }
        u_socket.emit('roomSharer', roomSharer)
      }
    }
  })

  socket.on('leaveRoom', async (data) => {
    onUserLeaveOrLeaveRoom(userId, data.roomId)
  })

  socket.on('disconnect', async () => {
    console.log('dis', userId, roomId)
    if (Number(userId) === 1010) {
      findAndUpdateRoomStatus(-1)
    }
    onUserLeaveOrLeaveRoom(userId, roomId)
  })

  socket.on('roomUserList', async (data) => {
    const _roomId = data.roomId || roomId
    const roomUserList = Object.values(await getRoomUser(_roomId))
    socket.emit('roomUserList', roomUserList)
    emitRoomListToSockets()
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