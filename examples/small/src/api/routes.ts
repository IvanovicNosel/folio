import { Router } from 'express'
import { registerHandler, loginHandler, meHandler } from './controllers/auth.js'
import { requireAuth } from './middleware.js'

const router = Router()

router.post('/auth/register', registerHandler)
router.post('/auth/login', loginHandler)
router.get('/auth/me', requireAuth, meHandler)

export default router
