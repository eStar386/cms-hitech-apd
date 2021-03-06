const defaultZxcvbn = require('zxcvbn');
const logger = require('../logger')('user db');
const defaultHash = require('../auth/passwordHash');

const knex = require('./knex');

const sanitizeUser = user => ({
  activities: user.activities,
  id: user.id,
  name: user.name,
  phone: user.phone,
  position: user.position,
  role: user.auth_role,
  state: user.state,
  username: user.email
});

const populateUser = async (user, { db = knex } = {}) => {
  if (user) {
    const populatedUser = user;

    if (user.auth_role) {
      const authRole = await db('auth_roles')
        .where({
          name: user.auth_role,
          isActive: true
        })
        .select('id')
        .first();

      const authActivityIDs = authRole
        ? await db('auth_role_activity_mapping')
            .where('role_id', authRole.id)
            .select('activity_id')
        : [];

      const authActivityNames = await db('auth_activities')
        .whereIn(
          'id',
          // eslint-disable-next-line camelcase
          authActivityIDs.map(({ activity_id }) => activity_id)
        )
        .select('name');

      populatedUser.activities = authActivityNames.map(({ name }) => name);
    } else {
      populatedUser.activities = [];
    }

    if (user.state_id) {
      const state = await db('states')
        .where('id', user.state_id)
        .select('id', 'name')
        .first();
      populatedUser.state = state;
    } else {
      populatedUser.state = {};
    }

    delete populatedUser.state_id;

    return populatedUser;
  }

  return user;
};

const deleteUserByID = async (id, { db = knex } = {}) =>
  db('users')
    .where('id', id)
    .delete();

const getAllUsers = async ({
  clean = true,
  db = knex,
  populate = populateUser
} = {}) => {
  const users = await db('users').select();

  const full = await Promise.all(users.map(populate));

  if (clean) {
    return full.map(sanitizeUser);
  }
  return full;
};

const getUserByEmail = async (
  email,
  { clean = true, db = knex, populate = populateUser } = {}
) => {
  const user = await populate(
    await db('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first()
  );

  return user && clean ? sanitizeUser(user) : user;
};

const getUserByID = async (
  id,
  { clean = true, db = knex, populate = populateUser } = {}
) => {
  const user = await populate(
    await db('users')
      .where('id', id)
      .first()
  );

  return user && clean ? sanitizeUser(user) : user;
};

const validateUser = async (
  // eslint-disable-next-line camelcase
  { id, email, password, auth_role, phone, state_id },
  { db = knex, getUser = getUserByEmail, zxcvbn = defaultZxcvbn } = {}
) => {
  /* eslint-disable camelcase */
  if (email) {
    logger.silly('checking email');

    const usersWithEmail = await getUser(email);

    if (usersWithEmail && usersWithEmail.id !== id) {
      logger.verbose(`user with email already exists [${email}]`);
      throw new Error('email-exists');
    }

    logger.silly('email is unique');
  }

  if (password) {
    logger.silly('checking password complexity/strength');

    const compare = [];
    if (id) {
      const user = await db('users')
        .where('id', id)
        .select('email', 'name')
        .first();

      compare.push(email || user.email);
      compare.push(user.name);
    }

    const passwordScore = zxcvbn(password, compare);
    if (passwordScore.score < 3) {
      logger.verbose(`password is too weak: score ${passwordScore.score}`);
      throw new Error('weak-password');
    }

    logger.silly('password is sufficiently complex');
  }

  if (phone) {
    logger.silly('checking phone is just 10 digits');

    const numericPhone = phone.replace(/[^\d]/g, '');
    if (numericPhone.length > 10) {
      logger.verbose(`phone number is invalid [${phone}]`);
      throw new Error('invalid-phone');
    }

    logger.silly('phone is valid');
  }

  if (auth_role) {
    logger.silly('checking auth role');
    if (
      !(await db('auth_roles')
        .where({
          name: auth_role,
          isActive: true
        })
        .first())
    ) {
      logger.verbose(`auth role is invalid or inactive [${auth_role}]`);
      throw new Error('invalid-role');
    }
    logger.silly('auth role is valid');
  }

  if (state_id) {
    logger.silly('checking state ID');
    if (
      !(await db('states')
        .where('id', state_id)
        .first())
    ) {
      logger.verbose(`state ID is invalid [${state_id}]`);
      throw new Error('invalid-state');
    }
    logger.silly('state ID is valid');
  }
};

const createUser = async (
  user,
  { db = knex, hash = defaultHash, validate = validateUser } = {}
) => {
  await validate(user);

  const save = { ...user };
  if (user.password) {
    save.password = await hash.hash(user.password);
  }
  if (user.phone) {
    save.phone = user.phone.replace(/[^\d]/g, '');
  }

  const ids = await db('users')
    .insert(save)
    .returning('id');

  return ids[0];
};

const updateUser = async (
  userID,
  user,
  { db = knex, hash = defaultHash, validate = validateUser } = {}
) => {
  await validate({ ...user, id: userID });

  if (!Object.keys(user).length) {
    return;
  }

  const save = { ...user };
  if (user.password) {
    save.password = await hash.hash(user.password);
  }
  if (user.phone) {
    save.phone = user.phone.replace(/[^\d]/g, '');
  }

  await db('users')
    .where('id', userID)
    .update(save);
};

module.exports = {
  createUser,
  deleteUserByID,
  getAllUsers,
  getUserByEmail,
  getUserByID,
  populateUser,
  sanitizeUser,
  updateUser,
  validateUser
};
