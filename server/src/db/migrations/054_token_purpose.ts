const { db, run } = require('../index');

module.exports = {
  name: '054_token_purpose',
  up: () => {
    db.exec(`
      ALTER TABLE user_verifications ADD COLUMN purpose TEXT NOT NULL DEFAULT 'verify';
    `);
    run('CREATE INDEX IF NOT EXISTS idx_user_verifications_token_purpose ON user_verifications(token, purpose)');
    run('CREATE INDEX IF NOT EXISTS idx_user_verifications_user_purpose ON user_verifications(user_id, purpose)');
  },
};