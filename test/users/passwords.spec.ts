import Hash from '@ioc:Adonis/Core/Hash'
import Mail from '@ioc:Adonis/Addons/Mail'
import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import { DateTime, Duration } from 'luxon'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

test.group('Password', (group) => {
  test('it should send an email for password recovery', async (assert) => {
    const user = await UserFactory.create()

    Mail.trap((message) => {
      assert.deepEqual(message.to, [
        {
          address: user.email,
        },
      ])
      assert.deepEqual(message.from, {
        address: 'no-reply@roleplay.com',
      })
      assert.equal(message.subject, 'Roleplay: Recuperação de senha')
      assert.include(message.html!, user.username)
    })

    await supertest(BASE_URL)
      .post('/password-recovery')
      .send({ email: user.email, resetPasswordUrl: 'url' })
      .expect(204)

    Mail.restore()
  })

  test('it should create a token', async (assert) => {
    const user = await UserFactory.create()

    await supertest(BASE_URL)
      .post('/password-recovery')
      .send({ email: user.email, resetPasswordUrl: 'url' })
      .expect(204)

    const tokens = await user.related('tokens').query()
    assert.isNotEmpty(tokens)
  })

  test('it should return 422 required data not provided or invalid', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/password-recovery').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should reset password', async (assert) => {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'token' })

    await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password: '123456' })
      .expect(204)

    await user.refresh()
    const check = await Hash.verify(user.password, '123456')
    assert.isTrue(check)
  })

  test('it should return 422 required data not provided or invalid', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/reset-password').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should return 404 link token already used', async (assert) => {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'token' })

    await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password: '123456' })
      .expect(204)

    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password: '123456' })
      .expect(404)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('it cannot reset password token expired', async (assert) => {
    const user = await UserFactory.create()
    const date = DateTime.now().minus(Duration.fromISOTime('02:01'))
    const { token } = await user.related('tokens').create({ token: 'token', createdAt: date })
    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password: '123456' })
      .expect(410)

    assert.equal(body.code, 'TOKEN_EXPIRED')
    assert.equal(body.status, 410)
    assert.equal(body.message, 'token has expired')
  })

  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })
  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })
})
