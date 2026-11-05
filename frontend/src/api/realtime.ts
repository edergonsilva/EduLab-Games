import { io } from 'socket.io-client'

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

export function subscribeToRooms(
  roomCodes: string[],
  onRoomEvent: (eventName: string, payload: unknown) => void,
  onReconnect: () => void,
) {
  const socket = io({ path: '/socket.io/', withCredentials: true })

  socket.on('connect', () => {
    for (const roomCode of roomCodes) {
      socket.emit('room.join', { room_code: roomCode })
    }
    onReconnect()
  })
  socket.onAny((eventName, payload) => {
    if (roomEvents.has(eventName)) onRoomEvent(eventName, payload)
  })

  return () => {
    socket.disconnect()
  }
}