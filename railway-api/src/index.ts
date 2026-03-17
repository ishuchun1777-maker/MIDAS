import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({
  status: 'ok',
  name: 'MIDAS API',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}))

app.get('/', async () => ({
  message: 'MIDAS API ishlayapti!',
}))

const port = parseInt(process.env.PORT || '3001')

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`MIDAS API server: http://0.0.0.0:${port}`)
})