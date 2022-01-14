import Mail from '@ioc:Adonis/Addons/Mail'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import TokenExpired from 'App/Exceptions/TokenExpiredException'
import User from 'App/Models/User'
import PasswordRecovery from 'App/Validators/PasswordRecoveryValidator'
import ResetPassword from 'App/Validators/ResetPasswordValidator'
import { randomBytes } from 'crypto'
import { promisify } from 'util'

export default class PasswordsController {
  public async passwordRecovery({ response, request }: HttpContextContract) {
    const { email, resetPasswordUrl } = await request.validate(PasswordRecovery)
    const user = await User.findByOrFail('email', email)

    const random = await promisify(randomBytes)(24)
    const token = random.toString('hex')
    await user.related('tokens').updateOrCreate({ userId: user.id }, { token })

    const resetPasswordUrlToken = `${resetPasswordUrl}?token=${token}`
    await Mail.send((message) => {
      message
        .from('no-reply@roleplay.com')
        .to(email)
        .subject('Roleplay: Recuperação de senha')
        .htmlView('email/passwordrecovery', {
          productName: 'RolePlay',
          name: user.username,
          resetPasswordUrl: resetPasswordUrlToken,
        })
    })

    return response.noContent()
  }
  public async resetPassword({ response, request }: HttpContextContract) {
    const { token, password } = await request.validate(ResetPassword)

    const user = await User.query()
      .whereHas('tokens', (query) => {
        query.where('token', token)
      })
      .preload('tokens')
      .firstOrFail()

    const tokenAge = Math.abs(user.tokens[0].createdAt.diffNow('hours').hours)
    if (tokenAge > 2) throw new TokenExpired()

    user.password = password
    await user.save()
    await user.tokens[0].delete()

    return response.noContent()
  }
}
