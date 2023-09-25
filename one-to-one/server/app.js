const express = require('express')
const { Server } = require('socket.io')
const http = require('http')

const app = new express()
const httpServer = http.createServer(app)
httpServer.listen(3333)

const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
})

httpServer.on('listening', () => {
  let addr = httpServer.address()
  console.log("address: ", addr)
})

io.on('connection', (socket) => {
  console.log(socket)
  const { query } = socket.handshake
  const { username, room, members } = query
  console.log(query)
  console.log(room, username, members)

  if (members.length >= 2) {
    return
  }

  const user = { userId: socket.id, username }
  members.push(user)
  socket.join(room)
  io.to(room).emit('userList', members)

  socket.on('candidate', (room, candidate) => {
    socket.to(room).emit('candidate', candidate)
  })
  socket.on('offer', (room, offer) => {
    socket.to(room).emit('offer', offer)
  })
  socket.on('answer', (room, answer) => {
    socket.to(room).emit('answer', answer)
  })
  socket.on('disconnect', () => {
    members = members.filter((m) => m.username !== user.username)
    io.to(room).emit('userList', members)
  })
})
