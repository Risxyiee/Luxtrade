import { Server } from 'socket.io'

const PORT = 3004

const io = new Server(PORT, {
  cors: {
    origin: '*', // Allow all origins in dev
    methods: ['GET', 'POST'],
  },
})

// Track connected clients by user_id for targeted updates
const clients = new Map<string, Set<string>>() // userId -> Set<socketId>

io.on('connection', (socket) => {
  console.log(`[affiliate-ws] Client connected: ${socket.id}`)

  // User joins their personal room
  socket.on('affiliate:join', (userId: string) => {
    if (!userId || typeof userId !== 'string') return
    socket.join(`user:${userId}`)
    
    if (!clients.has(userId)) {
      clients.set(userId, new Set())
    }
    clients.get(userId)!.add(socket.id)
    console.log(`[affiliate-ws] User ${userId} joined (${clients.get(userId)!.size} connections)`)
  })

  // User leaves their room
  socket.on('affiliate:leave', (userId: string) => {
    if (!userId) return
    socket.leave(`user:${userId}`)
    const userClients = clients.get(userId)
    if (userClients) {
      userClients.delete(socket.id)
      if (userClients.size === 0) {
        clients.delete(userId)
      }
    }
  })

  // Relay events from API routes to targeted user
  socket.on('affiliate:event', (data: { userId: string; event: string; payload: any }) => {
    const { userId, event, payload } = data
    if (!userId || !event) return
    io.to(`user:${userId}`).emit(event, payload)
    console.log(`[affiliate-ws] Event "${event}" sent to user:${userId}`)
  })

  // Broadcast to all clients in a room
  socket.on('affiliate:broadcast', (data: { room: string; event: string; payload: any }) => {
    const { room, event, payload } = data
    io.to(room).emit(event, payload)
  })

  // Ping/pong for keepalive
  socket.on('ping', () => {
    socket.emit('pong')
  })

  socket.on('disconnect', () => {
    console.log(`[affiliate-ws] Client disconnected: ${socket.id}`)
    // Clean up client from all rooms
    for (const [userId, socketIds] of clients.entries()) {
      socketIds.delete(socket.id)
      if (socketIds.size === 0) {
        clients.delete(userId)
      }
    }
  })
})

console.log(`🚀 [affiliate-ws] WebSocket server running on port ${PORT}`)

// Export for external use (when imported by other services)
export { io }
