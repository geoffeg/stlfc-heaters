const express = require('express')
const mqtt = require('async-mqtt')
const app = express()
const port = 3000

const switchStatus = {
  N2242N : { status : "Unknown", power: 0 },
  N20843 : { status : "Unknown", power: 0 },
  N202CR : { status : "Unknown", power: 0 }
}

app.set('views', './views')
app.set('view engine', 'pug')

app.get('/',  (req, res) => {
  res.render('index', { aircraftStatus: switchStatus })
})

app.get('/aircraft/:aircraft', (req, res) => {
  res.render('status', { tailNumber: req.params.aircraft, aircraftStatus: switchStatus })
})

app.get('/aircraft/:aircraft/:command', async (req, res) => {
  await client.publish(`shellies/${req.params.aircraft}/relay/0/command`, req.params.command)
  res.status(204).send()
})
//app.get('/aircraft/:aircraft/:command', async (req, res) => {
//  await client.publish(`shellies/${req.params.aircraft}/relay/0/command`, req.params.command)
//  res.render('status', { tailNumber: req.params.aircraft, aircraftStatus: switchStatus })
//})

app.get('/events/:aircraft', async(req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write('retry: 10000\n\n')
  console.log(req.params.aircraft)

  res.on('close', () => {
    console.log('Closing connection')
    //res.end()
    return
  })
  
  client.on('message', (topic, message) => {
    const switchId = topic.split("/")[1]
    if (switchId == req.params.aircraft) {
      if (topic.endsWith("0")) {
        switchStatus[switchId].status = message.toString()
      } else if (topic.endsWith("power")) {
        switchStatus[switchId].power = parseInt(message)
      }

      res.render('status', { tailNumber: switchId, aircraftStatus: switchStatus }, (err, html) => {
        console.log(html)
        res.write('event: statusUpdate-' + switchId + '\n')
        res.write('data: ' + html + '\n\n')
      })
    }
  })
})

app.listen(port, async () => {
  client = await mqtt.connectAsync('mqtt://100.73.158.21')
  client.subscribe(['shellies/+/relay/0', 'shellies/+/relay/0/power'])

  client.on('message', (topic, message) => {
    //console.log(`Received message "${message}" on topic "${topic}"`)
    const switchId = topic.split("/")[1]
    if (topic.endsWith("0")) {
      switchStatus[switchId].status = message.toString()
    } else if (topic.endsWith("power")) {
      switchStatus[switchId].power = parseInt(message)
    }
  })
  console.log(`Listening on http://localhost:${port}`)
})
