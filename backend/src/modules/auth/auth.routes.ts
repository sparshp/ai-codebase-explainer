import { Router } from 'express'
import { validate } from '@middleware/validate.middleware'
import { authMiddleware } from '@middleware/auth.middleware'
import { registerSchema, loginSchema } from './auth.schema'
import * as ctrl from './auth.controller'

const router = Router()

router.post('/register', validate(registerSchema), ctrl.register)
router.post('/login',    validate(loginSchema),    ctrl.login)
router.post('/refresh',                            ctrl.refresh)
router.get('/me',        authMiddleware,            ctrl.me)

export default router