import { io, Socket } from 'socket.io-client'

const roomEvents = new Set([
  'room.updated',
  'participant.joined',
  'participant.updated',
  'participant.disconnected',
  'activity.started',
  'activity.finished',
  'activity.score',
  'activity.progress',
  'activity.completed',
])

// Global persistent socket connection
let globalSocket: Socket | null = null

function getSocket(): Socket {
  if (!globalSocket) {
    //console.log('📍 Iniciando Socket.IO connection...')
    //console.log('📍 Current URL:', window.location.href)
    //console.log('📍 Origin:', window.location.origin)
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    if (!backendUrl) {
      throw new Error('VITE_BACKEND_URL não configurada.')
    }
    //console.log('📍 Backend URL:', backendUrl)
    
    // Create socket and immediately log all requests
    const socket = io(backendUrl, { 
      path: '/socket.io/',
      withCredentials: true,
      transports: ['websocket', 'polling' ],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })
    
    // Intercept all requests for debugging
    if (socket.io && socket.io.engine) {
      socket.io.engine.on('message', () => {
        //console.log('📨 Message received')
      })
      socket.io.engine.on('error', () => {
        //console.error('⚠️ Engine error occurred')
      })
    }
    
    // Debug logging
    socket.on('connect', () => {
      //console.log('🟢 Socket.IO connected:', socket.id)
      //console.log('🔗 Transport:', socket.io.engine.transport.name)
      globalSocket = socket
    })
    socket.on('disconnect', () => {
      //console.log('🔴 Socket.IO disconnected')
    })
    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO error:', error)
    })
    
    // Assign to global if connection succeeds
    globalSocket = socket
  }
  return globalSocket
}

export function subscribeToRooms(
  roomCodes: string[],
  onRoomEvent: (eventName: string, payload?: unknown) => void,
  onReconnect: () => void,
) {
  const socket = getSocket()

  console.log(
    '📡 subscribeToRooms:',
    roomCodes,
    'Connected:',
    socket.connected,
  )

  // Evita códigos duplicados dentro da mesma inscrição
  const uniqueRoomCodes = [...new Set(roomCodes)]

  // Controla se já ocorreu a primeira conexão desta inscrição
  let firstConnection = !socket.connected

  const joinRooms = () => {
    for (const roomCode of uniqueRoomCodes) {
      socket.emit(
        'room.join',
        { room_code: roomCode },
        (response: unknown) => {
          console.log(
            '📨 room.join response:',
            roomCode,
            response,
          )
        },
      )
    }
  }

  const handleConnect = () => {
    //console.log('🟢 Socket connected. Joining rooms...')

    joinRooms()

    if (firstConnection) {
      firstConnection = false
      return
    }

    //console.log('🔄 Socket reconnected. Refreshing state...')
    onReconnect()
  }

  const handleAnyEvent = (
    eventName: string,
    ...args: unknown[]
  ) => {
    if (!roomEvents.has(eventName)) return

    //console.log('📨 Event received:', eventName, args[0])

    onRoomEvent(eventName, args[0])
  }

  // Primeiro registra os listeners
  socket.on('connect', handleConnect)
  socket.onAny(handleAnyEvent)

  // Se já estiver conectado, entra nas salas imediatamente.
  // Caso contrário, handleConnect fará isso na primeira conexão.
  if (socket.connected) {
    joinRooms()
  }

  return () => {
    //console.log(
    //  '🧹 Cleaning up listeners for:',
    //  uniqueRoomCodes,
    //)

    socket.off('connect', handleConnect)
    socket.offAny(handleAnyEvent)

    // Não desconectar o socket global!
  }
}