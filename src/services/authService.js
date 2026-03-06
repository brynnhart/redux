import bcrypt from 'bcryptjs';
const ROUNDS = 10;
export class AuthService {
    hashPassword(pass) {
        return bcrypt.hashSync(pass, ROUNDS);
    }
    verifyPassword(pass, hash) {
        return bcrypt.compareSync(pass, hash);
    }
}
