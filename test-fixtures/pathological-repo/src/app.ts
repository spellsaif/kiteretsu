import { formatUser } from './utils.js';

export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: Map<string, User> = new Map();

  async createUser(id: string, name: string, email: string): Promise<User> {
    const user: User = { id, name, email };
    this.users.set(id, user);
    return user;
  }

  getUser(id: string): string {
    const user = this.users.get(id);
    if (!user) return 'User not found';
    return formatUser(user.name, user.email);
  }
}
