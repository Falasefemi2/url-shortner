import { Hono } from "hono"
import auth from './routes/auth'
import url, { redirectToLongUrl } from './routes/url'

const app = new Hono()

app.route('/auth', auth)
app.route('/url', url)
app.get('/:code', redirectToLongUrl)

export default app
