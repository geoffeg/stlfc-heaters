const express = require('express')
const mqtt = require('async-mqtt')
const app = express()
const port = 3000

const switchStatus = {
  N2242N : { status : "Unknown", power: 0 },
  N20843 : { status : "Unknown", power: 0 },
  N202CR : { status : "Unknown", power: 0 }
}

const listeners = []

app.set('views', './views')
app.set('view engine', 'pug')
app.use(express.static('public'))

app.get('/',  (req, res) => {
  res.render('index', { aircraftStatus: switchStatus })
})

app.get('/aircraft/:aircraft/:command', async (req, res) => {
  await client.publish(`shellies/${req.params.aircraft}/relay/0/command`, req.params.command)
  res.status(204).send()
})

app.get('/events', async(req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write('retry: 10000\n\n')
  listeners.push(res)

  res.on('close', () => {
    console.log('Closing connection')
    const index = listeners.indexOf(res)
    listeners.splice(index, 1)
    console.log("Remaining connections", listeners.length)
    res.end()
    return
  })
})

app.listen(port, async () => {
  client = await mqtt.connectAsync('mqtt://100.73.158.21')
  client.subscribe(['shellies/+/relay/0', 'shellies/+/relay/0/power'])

  client.on('message', (topic, message) => {
    console.log(`Received message "${message}" on topic "${topic}"`)
    const switchId = topic.split("/")[1]
    if (topic.endsWith("0")) {
      switchStatus[switchId].status = message.toString()
    } else if (topic.endsWith("power")) {
      switchStatus[switchId].power = parseInt(message)
    }
    listeners.forEach((res) => {
      res.render('status', { tailNumber: switchId, aircraftStatus: switchStatus }, (err, html) => {
        try {
          console.log(switchId, html)
          res.write('event: statusUpdate-' + switchId + '\n')
          res.write('data: ' + html + '\n\n')
        } catch (ex) {
          console.log("Exception writing SSE response", ex)
        }
      })
    })
  })
  console.log(`Listening on http://localhost:${port}`)
})
