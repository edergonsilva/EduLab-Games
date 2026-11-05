;(function attachEduLabSDK(global) {
  const embedded = global.parent !== global
  const handlers = new Map()
  let context = null
  let started = false
  let finished = false

  function parentOrigin() {
    if (!embedded || !global.document.referrer) return null
    try {
      return new URL(global.document.referrer).origin
    } catch {
      return null
    }
  }

  function emit(type, payload) {
    if (!embedded || !context || finished || !parentOrigin()) return false
    global.parent.postMessage({
      namespace: 'edulab.sdk',
      type,
      payload: payload || {},
      session: context.session,
    }, parentOrigin())
    return true
  }

  function notify(name, payload) {
    for (const callback of handlers.get(name) || []) {
      try {
        callback(payload)
      } catch (error) {
        global.setTimeout(() => { throw error }, 0)
      }
    }
  }

  if (embedded) {
    global.addEventListener('message', (event) => {
      if (event.source !== global.parent || event.origin !== parentOrigin()) return
      const message = event.data
      if (!message || message.namespace !== 'edulab.sdk') return

      if (message.type === 'init') {
        context = message.payload || null
        started = Boolean(context)
        notify('start', context)
        emit('ready', {})
        return
      }

      if (!context || !message.session || message.session.nonce !== context.session.nonce) return
      if (message.type === 'activity.pause') notify('pause', message.payload)
      if (message.type === 'activity.resume') notify('resume', message.payload)
      if (message.type === 'activity.finish') {
        finished = true
        notify('finish', message.payload)
      }
    })
  }

  global.EduLabSDK = {
    score(score) {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return false
      return emit('score', { score })
    },
    progress(progress) {
      if (!progress || typeof progress !== 'object') return false
      const { current, total } = progress
      if (!Number.isFinite(current) || !Number.isFinite(total) || current < 0 || total < current) return false
      return emit('progress', { progress: { current, total } })
    },
    completed(result) {
      if (finished || !result || typeof result !== 'object') return false
      if (result.score !== undefined && (!Number.isFinite(result.score) || result.score < 0)) return false
      const sent = emit('completed', result)
      if (sent) finished = true
      return sent
    },
    error(error) {
      if (!error || typeof error.message !== 'string') return false
      return emit('error', { message: error.message.slice(0, 500) })
    },
    on(name, callback) {
      if (typeof callback !== 'function') return () => {}
      const callbacks = handlers.get(name) || new Set()
      callbacks.add(callback)
      handlers.set(name, callbacks)
      return () => callbacks.delete(callback)
    },
    isEmbedded() {
      return embedded
    },
    isStarted() {
      return started
    },
    isFinished() {
      return finished
    },
  }
})(window)