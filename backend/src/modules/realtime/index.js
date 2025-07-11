// backend/src/modules/realtime/index.js
import { Server } from 'socket.io'
import { findBoardById, createBoard } from '../board/persistence/boardRepository.js'

let io

export function initRealtime(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
  })

  io.on('connection', socket => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    socket.on('joinBoard', async boardId => {
      socket.join(boardId)
      console.log(`${socket.id} se unió a la sala ${boardId}`)

      // Asegurarnos de que la pizarra existe (upsert)
      await createBoard(boardId)
      // Recuperar estado
      const board = await findBoardById(boardId)
      socket.emit('board:init', board.elements || [])
    })

    socket.on('board:add', ({ boardId, element }) => {
      io.to(boardId).emit('board:add', element)
    })

    socket.on('board:update', ({ boardId, elementId, ...upd }) => {
      io.to(boardId).emit('board:update', { elementId, ...upd })
    })

    socket.on('board:remove', ({ boardId, elementId }) => {
      io.to(boardId).emit('board:remove', elementId)
    })

    socket.on('chat:message', ({ boardId, user, text }) => {
      const msg = { user, text, timestamp: Date.now() }
      socket.broadcast.emit('chat:message', msg) 
    })

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })

  return io
}

export function getIO() {
  if (!io) throw new Error('Realtime no inicializado')
  return io
}
