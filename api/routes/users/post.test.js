const tap = require('tap');
const sinon = require('sinon');

const can = require('../../middleware').can;
const postEndpoint = require('./post');

tap.test('user POST endpoint', async endpointTest => {
  const sandbox = sinon.createSandbox();
  const app = {
    post: sandbox.stub()
  };

  const createUser = sandbox.stub();
  const validateUser = sandbox.stub();

  const res = {
    status: sandbox.stub(),
    send: sandbox.stub(),
    end: sandbox.stub()
  };

  endpointTest.beforeEach(done => {
    sandbox.resetBehavior();
    sandbox.resetHistory();

    res.status.returns(res);
    res.send.returns(res);
    res.end.returns(res);

    done();
  });

  endpointTest.test('setup', async setupTest => {
    postEndpoint(app);

    setupTest.ok(
      app.post.calledWith('/users', can('add-users'), sinon.match.func),
      'user POST endpoint is registered'
    );
  });

  endpointTest.test('handler', async handlerTest => {
    let handler;

    handlerTest.beforeEach(done => {
      postEndpoint(app, { createUser, validateUser });
      handler = app.post.args[0][2];
      done();
    });

    handlerTest.test(
      'rejects if the data is missing',
      async missingDataTests => {
        [{}, { email: 'em@il' }, { password: 'password' }].forEach(scenario => {
          missingDataTests.test('', async invalidTest => {
            await handler({ body: scenario }, res);

            invalidTest.ok(
              res.status.calledWith(400),
              'HTTP status set to 400'
            );
            invalidTest.ok(
              res.send.calledWith({ error: 'add-account.invalid' }),
              'error token is set'
            );
            invalidTest.ok(res.end.called, 'response is terminated');
          });
        });
      }
    );

    handlerTest.test(
      'rejects if the data model validation fails',
      async invalidTest => {
        validateUser.rejects(new Error('invalidate-test'));

        await handler(
          {
            body: { email: 'all-permissions-and-state', password: 'password' }
          },
          res
        );

        invalidTest.ok(res.status.calledWith(400), 'HTTP status set to 400');
        invalidTest.ok(
          res.send.calledWith({ error: 'add-account.invalidate-test' }),
          'error token is set'
        );
        invalidTest.ok(res.end.called, 'response is terminated');
      }
    );

    handlerTest.test(
      'sends a server error code if there is a database error inserting a new user',
      async invalidTest => {
        validateUser.resolves();
        createUser.rejects();

        await handler(
          {
            body: { email: 'all-permissions-and-state', password: 'password' }
          },
          res
        );

        invalidTest.ok(res.status.calledWith(500), 'HTTP status set to 500');
        invalidTest.ok(res.send.notCalled, 'does not send a message');
        invalidTest.ok(res.end.called, 'response is terminated');
      }
    );

    handlerTest.test(
      'inserts a new user and returns a success for a valid, new user',
      async validTest => {
        validateUser.resolves();
        createUser.resolves([1]);

        await handler(
          {
            body: {
              email: 'all-permissions-and-state',
              name: 'their new name',
              password: 'password',
              phone: 'phone number',
              position: 'position',
              role: 'auth role',
              state: 'state id',
              junk: 'thrown away'
            }
          },
          res
        );

        validTest.ok(
          createUser.calledWith({
            auth_role: 'auth role',
            email: 'all-permissions-and-state',
            name: 'their new name',
            password: 'password',
            phone: 'phone number',
            position: 'position',
            state_id: 'state id'
          }),
          'user is created with only the accepted fields'
        );
        validTest.ok(res.status.calledWith(200), 'HTTP status set to 200');
        validTest.ok(res.send.notCalled, 'does not send a message');
        validTest.ok(res.end.called, 'response is terminated');
      }
    );
  });
});
