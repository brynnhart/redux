import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export class AuthService {
  hashPassword(pass: string) {
    return bcrypt.hashSync(pass, ROUNDS);
  }

  verifyPassword(pass: string, hash: string) {
    return bcrypt.compareSync(pass, hash);
  }
}
