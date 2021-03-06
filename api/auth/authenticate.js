// Local database authentication strategy. The default export is the strategy
// that will be passed into Passport.js and actually handles authenticating a
// request. Also exports a getNonce utility function.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const defaultHash = require('./passwordHash');
const logger = require('../logger')('authentication');
const {
  getUserByEmail: gue,
  sanitizeUser: su,
  updateUser: uu
} = require('../db');

// This value doesn't need to be persisted between process instances of the
// server. It only needs to persist between the request for the nonce and the
// request to authenticate. Using a random secret on every process restart
// should somewhat increase security - automatic key cycling!
const NONCE_SECRET = crypto.randomBytes(64);

module.exports = ({
  getUserByEmail = gue,
  hash = defaultHash,
  sanitizeUser = su,
  updateUser = uu
} = {}) => async (nonce, password, done) => {
  try {
    logger.verbose(`got authentication request. decoding jwt...`);
    let verified = false;
    try {
      // Supplying a secret to the verify call mitigates the "none" algorithm
      // vulnerability, but let's specify our algorithms anayway.
      verified = jwt.verify(nonce, NONCE_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      logger.error(`error decoding token: ${e.message}`);
      return done(null, false);
    }

    const username = verified.username;
    logger.verbose(`authentication request for [${username}]`);

    const user = await getUserByEmail(username, { clean: false });

    if (user && user.locked_until) {
      // If the lock date is still in the future, we can bail out now.
      if (user.locked_until > Date.now()) {
        logger.warn(
          'account is locked due to excessive failed logons; not processing request'
        );
        return done(null, false);
      }

      // The lock has expired, so go ahead and clear it.
      await updateUser(user.id, { failed_logons: null, locked_until: null });
    }

    if (user && (await hash.compare(password, user.password))) {
      logger.verbose(`authenticated user [${username}]`);

      return done(null, sanitizeUser(user));
    }

    // If the user was found and we're here, then the password didn't match.
    // Increment the fail count and check if we need to lock the account.
    if (user) {
      const windowTime =
        +process.env.AUTH_LOCK_FAILED_ATTEMPTS_WINDOW_TIME_MINUTES * 60000;
      // Get only the failed logons that are still within the failure window.
      // E.g., if the rule is to lock accounts after 5 failed logon attempts
      // within 10 minutes, we only need to look at the failed logon attempts
      // within the past 10 minutes. Logons longer ago than that are irrelevant
      const failedLogons = (user.failed_logons || []).filter(
        failure => failure > Date.now() - windowTime
      );
      failedLogons.push(Date.now());

      const update = {
        failed_logons: JSON.stringify(failedLogons)
      };

      if (failedLogons.length >= +process.env.AUTH_LOCK_FAILED_ATTEMPTS_COUNT) {
        const duration =
          +process.env.AUTH_LOCK_FAILED_ATTEMPTS_DURATION_MINUTES * 60000;
        update.locked_until = Date.now() + duration;
      }

      await updateUser(user.id, update);
    }

    logger.verbose(`no user found or password mismatch for [${username}]`);
    return done(null, false);
  } catch (e) {
    logger.error(null, e);
    return done('Error');
  }
};

/**
 * Get an authentication nonce
 * @param {String} username - Username associated with the nonce
 */
module.exports.getNonce = username =>
  jwt.sign({ username }, NONCE_SECRET, {
    algorithm: 'HS256',
    expiresIn: '3s'
  });
