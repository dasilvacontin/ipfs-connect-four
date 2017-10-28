let username = prompt("What's your name?")
const IPFS = require('ipfs')
const Room = require('ipfs-pubsub-room')

const ipfs = new IPFS({
  repo: 'ipfs/pubsub-demo/' + Math.random(),
  EXPERIMENTAL: {
    pubsub: true
  }
})

const putOpts = { format: 'dag-cbor', hashAlg: 'sha2-256' }

ipfs.once('ready', () => ipfs.id((err, info) => {
  if (err) { throw err }
  console.log('IPFS node ready with address ' + info.id)
  console.log('------')
  const room = Room(ipfs, 'ipfs-pubsub-demo')

  const gameProposal = {
    players: [username],
    root: true
  }
  let gameProposalCid
  ipfs.dag.put(gameProposal, putOpts, (err, cid) => {
    gameProposalCid = cid.toBaseEncodedString()
    console.log(`my proposal cid: ${gameProposalCid}`)
    console.log('broadcasting proposal vvv')
  })

  let gameInProgress = false
  room.on('peer joined', (peer) => {
    if (!gameInProgress && info.id < peer) {
      console.log('peer connected, sending game proposal')
      room.sendTo(peer, `game-proposal,${gameProposalCid}`)
    }
  })

  room.on('message', (message) => {
    const payload = message.data.toString()
    console.log(message.from === info.id ? 'mine' : 'not mine', 'got message from ' + message.from + ': ' + payload)

    // ignore own messages
    console.log(message.from, info.id)
    if (message.from === info.id) return

    const [eventType, cid] = payload.split(',')
    console.log(eventType, cid)

    ipfs.dag.get(cid, (err, result) => {
      if (err) throw err
      console.log(result.value)

      if (!gameInProgress && eventType === 'game-proposal') {
        console.log(`got game proposal: ${cid}`)
        const acceptProposal = result.value
        acceptProposal.players.push(username)
        acceptProposal.turn = 0

        ipfs.dag.put(acceptProposal, putOpts, (err, cid) => {
          if (err) throw err
          const acceptProposalCid = cid.toBaseEncodedString()
          room.sendTo(message.from, `accept-proposal,${acceptProposalCid}`)
        })
      }
    })
  })
}))


// // broadcast message every 2 seconds

// setInterval(() => room.broadcast('hey everyone!'), 2000)