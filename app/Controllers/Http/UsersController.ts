import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BadRequest from 'App/Exceptions/BadRequestException'
import User from 'App/Models/User'
import CreateUser from 'App/Validators/CreateUserValidator'
import UpdateUser from 'App/Validators/UpdateUserValidator'

export default class UsersController {
  public async index({}: HttpContextContract) {}

  public async store({ request, response }: HttpContextContract) {
    const userPayLoad = await request.validate(CreateUser)

    const userByEmail = await User.findBy('email', userPayLoad.email)
    const userByUsername = await User.findBy('username', userPayLoad.username)

    if (userByEmail) throw new BadRequest('email already in use', 409)

    if (userByUsername) throw new BadRequest('username already in use', 409)

    const user = await User.create(userPayLoad)
    return response.created({ user })
  }

  public async show({}: HttpContextContract) {}

  public async update({ params, request, response }: HttpContextContract) {
    const userPayload = await request.validate(UpdateUser)
    const user = await User.findOrFail(params.id)

    await user.merge(userPayload)
    await user.save()

    return response.ok({ user })
  }

  public async destroy({}: HttpContextContract) {}
}
