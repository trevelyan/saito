const Key = require('./key');

describe('hasSharedSecret', () => {
  it('returns `0` if `aes_secret` not set', () => {
    Key.prototype.aes_secret = '';
    const result = Key.prototype.hasSharedSecret();

    expect(result).toBe(0);
  });

  it('returns `1` if `aes_secret` is set', () => {
    Key.prototype.aes_secret = 'my-aes_secret-key';
    const result = Key.prototype.hasSharedSecret();

    expect(result).toBe(1);
  });
});
